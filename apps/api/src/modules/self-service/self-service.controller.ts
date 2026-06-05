import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { authenticate } from '../auth/authenticate.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { fireAuditEvent } from '../audit/fire-audit.js';
import { sendNotFound } from '../../errors/index.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { SelfServiceRepository } from './self-service.repository.js';
import {
  SelfServiceCapabilityError,
  SelfServiceDeviceNotFoundError,
  SelfServiceExtensionNotFoundError,
  SelfServiceVoicemailNotFoundError,
  SelfServiceVoicemailPlaybackPathError,
  SelfServiceService,
} from './self-service.service.js';

const repo = new SelfServiceRepository(db);
const service = new SelfServiceService(repo);

const DndBodySchema = z.object({ enabled: z.boolean() });
const UuidParamsSchema = z.object({ id: z.string().uuid() });

const CallForwardBodySchema = z.object({
  enabled: z.boolean(),
  target: z.string().max(30).nullable().optional(),
});

const PolicyBodySchema = z.object({
  voicemail_view: z.boolean().optional(),
  voicemail_pin_change: z.boolean().optional(),
  dnd_manage: z.boolean().optional(),
  call_forward_manage: z.boolean().optional(),
  call_forward_set_target: z.boolean().optional(),
  call_history_view: z.boolean().optional(),
  device_view: z.boolean().optional(),
  sip_credential_reset: z.boolean().optional(),
});

function handleSelfServiceError(err: unknown, reply: FastifyReply): void {
  if (err instanceof SelfServiceExtensionNotFoundError) {
    sendNotFound(reply, err.message);
    return;
  }
  if (err instanceof SelfServiceVoicemailNotFoundError) {
    sendNotFound(reply, err.message);
    return;
  }
  if (err instanceof SelfServiceDeviceNotFoundError) {
    sendNotFound(reply, err.message);
    return;
  }
  if (err instanceof SelfServiceCapabilityError) {
    reply.code(403).send({
      error: 'SELF_SERVICE_CAPABILITY_DISABLED',
      message: err.message,
    });
    return;
  }
  if (err instanceof SelfServiceVoicemailPlaybackPathError) {
    reply.code(412).send({
      error: 'SELF_SERVICE_MEDIA_UNAVAILABLE',
      message: err.message,
    });
    return;
  }
  throw err;
}

// /me/* — end_user and above can use these
export const selfServiceMeController: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', authenticate);

  app.get('/extension', async (req, reply) => {
    const user = req.user as AuthClaims;
    try {
      return { data: await service.getMyExtension(user.sub, user.tenant_id) };
    } catch (err) {
      return handleSelfServiceError(err, reply);
    }
  });

  app.get('/dnd', async (req, reply) => {
    const user = req.user as AuthClaims;
    try {
      return { data: await service.getDnd(user.sub, user.tenant_id) };
    } catch (err) {
      return handleSelfServiceError(err, reply);
    }
  });

  app.put('/dnd', { schema: { body: DndBodySchema } }, async (req, reply) => {
    const user = req.user as AuthClaims;
    try {
      const ext = await service.setDnd(user.sub, user.tenant_id, req.body.enabled);
      fireAuditEvent({
        tenant_id: user.tenant_id,
        actor_id: user.sub,
        actor_role: user.role,
        action: req.body.enabled ? 'self_service.dnd_enabled' : 'self_service.dnd_disabled',
        resource_type: 'extension',
        resource_id: ext.id,
      });
      return { data: ext };
    } catch (err) {
      return handleSelfServiceError(err, reply);
    }
  });

  app.get('/call-forward', async (req, reply) => {
    const user = req.user as AuthClaims;
    try {
      return { data: await service.getCallForward(user.sub, user.tenant_id) };
    } catch (err) {
      return handleSelfServiceError(err, reply);
    }
  });

  app.put('/call-forward', { schema: { body: CallForwardBodySchema } }, async (req, reply) => {
    const user = req.user as AuthClaims;
    try {
      const ext = await service.setCallForward(user.sub, user.tenant_id, req.body.enabled, req.body.target);
      fireAuditEvent({
        tenant_id: user.tenant_id,
        actor_id: user.sub,
        actor_role: user.role,
        action: req.body.enabled ? 'self_service.call_forward_enabled' : 'self_service.call_forward_disabled',
        resource_type: 'extension',
        resource_id: ext.id,
        metadata: { target: req.body.target ?? null },
      });
      return { data: ext };
    } catch (err) {
      return handleSelfServiceError(err, reply);
    }
  });

  app.get(
    '/voicemail-messages',
    {
      schema: {
        querystring: z.object({
          unread_only: z.enum(['true', 'false']).default('false'),
          limit: z.coerce.number().int().min(1).max(100).default(50),
        }),
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return {
          data: await service.listVoicemailMessages(user.sub, user.tenant_id, {
            unreadOnly: req.query.unread_only === 'true',
            limit: req.query.limit,
          }),
        };
      } catch (err) {
        return handleSelfServiceError(err, reply);
      }
    },
  );

  app.post('/voicemail-messages/:id/read', { schema: { params: UuidParamsSchema } }, async (req, reply) => {
    const user = req.user as AuthClaims;
    try {
      return { data: await service.markVoicemailRead(user.sub, user.tenant_id, req.params.id) };
    } catch (err) {
      return handleSelfServiceError(err, reply);
    }
  });

  app.get('/voicemail-messages/:id/playback', { schema: { params: UuidParamsSchema } }, async (req, reply) => {
    const user = req.user as AuthClaims;
    try {
      const playback = await service.getVoicemailPlaybackPath(user.sub, user.tenant_id, req.params.id);
      const fileStat = await stat(playback.file_path);
      return reply
        .header('Content-Type', 'audio/wav')
        .header('Content-Length', fileStat.size.toString())
        .send(createReadStream(playback.file_path));
    } catch (err) {
      if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
        return sendNotFound(reply, 'Voicemail media file not found');
      }
      return handleSelfServiceError(err, reply);
    }
  });

  app.delete('/voicemail-messages/:id', { schema: { params: UuidParamsSchema } }, async (req, reply) => {
    const user = req.user as AuthClaims;
    try {
      await service.deleteVoicemailMessage(user.sub, user.tenant_id, req.params.id);
      return reply.code(204).send();
    } catch (err) {
      return handleSelfServiceError(err, reply);
    }
  });

  app.get('/call-history', async (req, reply) => {
    const user = req.user as AuthClaims;
    try {
      return { data: await service.listCallHistory(user.sub, user.tenant_id) };
    } catch (err) {
      return handleSelfServiceError(err, reply);
    }
  });

  app.get('/devices', async (req, reply) => {
    const user = req.user as AuthClaims;
    try {
      return { data: await service.listDevices(user.sub, user.tenant_id) };
    } catch (err) {
      return handleSelfServiceError(err, reply);
    }
  });

  app.delete(
    '/devices/:id',
    { schema: { params: UuidParamsSchema } },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const result = await service.revokeDevice(user.sub, user.tenant_id, req.params.id);
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role,
          action: 'self_service.device_revoked',
          resource_type: 'device_registration',
          resource_id: req.params.id,
        });
        return { data: result };
      } catch (err) {
        return handleSelfServiceError(err, reply);
      }
    },
  );

  app.post('/sip-credential/reset', async (req, reply) => {
    const user = req.user as AuthClaims;
    try {
      const credential = await service.resetSipCredential(user.sub, user.tenant_id);
      fireAuditEvent({
        tenant_id: user.tenant_id,
        actor_id: user.sub,
        actor_role: user.role,
        action: 'self_service.sip_credential_reset',
        resource_type: 'extension',
        resource_id: credential.extension_id,
      });
      return { data: credential };
    } catch (err) {
      return handleSelfServiceError(err, reply);
    }
  });
};

// /tenant/self-service-policy — tenant_admin only
export const selfServicePolicyController: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', authenticate);

  app.get(
    '/self-service-policy',
    { preHandler: requireCapability(CAPABILITIES.TENANT_USERS_MANAGE) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.getPolicy(user.tenant_id) };
    },
  );

  app.put(
    '/self-service-policy',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_USERS_MANAGE),
      schema: { body: PolicyBodySchema },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      const policy = await service.updatePolicy(user.tenant_id, req.body);
      fireAuditEvent({
        tenant_id: user.tenant_id,
        actor_id: user.sub,
        actor_role: user.role,
        action: 'self_service.policy_updated',
        resource_type: 'self_service_policy',
        resource_id: policy.id || user.tenant_id,
      });
      return { data: policy };
    },
  );
};
