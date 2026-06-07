import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { CreateVoicemailBoxBodySchema, UpdateVoicemailBoxBodySchema, UuidParamsSchema } from '@managecallai/contracts';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { VoicemailBoxRepository } from './voicemail-box.repository.js';
import {
  VoicemailBoxInputError,
  VoicemailBoxNotFoundError,
  VoicemailBoxService,
} from './voicemail-box.service.js';
import { sendNotFound, sendInvalidArgument, sendEntitlementLimitExceeded } from '../../errors/index.js';
import { entitlementSvc, EntitlementLimitExceededError } from '../entitlement/index.js';

const service = new VoicemailBoxService(new VoicemailBoxRepository(db));

function replyError(err: unknown, reply: FastifyReply): void {
  if (err instanceof VoicemailBoxNotFoundError) {
    return sendNotFound(reply, err.message);
  }
  if (err instanceof VoicemailBoxInputError) {
    return sendInvalidArgument(reply, err.message);
  }
  throw err;
}

export const voicemailBoxController: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/',
    { preHandler: requireCapability(CAPABILITIES.TENANT_VOICEMAIL_BOXES_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listByTenant(user.tenant_id) };
    },
  );

  app.post(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_VOICEMAIL_BOXES_CREATE),
      schema: { body: CreateVoicemailBoxBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        await entitlementSvc.assertWithinLimit(user.tenant_id, 'voicemail_box.max_count');
      } catch (err) {
        if (err instanceof EntitlementLimitExceededError) return sendEntitlementLimitExceeded(reply, err);
        throw err;
      }
      try {
        const box = await service.create({ ...req.body, tenant_id: user.tenant_id });
        return reply.code(201).send({ data: box });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.get(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_VOICEMAIL_BOXES_VIEW),
      schema: { params: UuidParamsSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.getById(req.params.id, user.tenant_id) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.patch(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_VOICEMAIL_BOXES_UPDATE),
      schema: {
        params: UuidParamsSchema,
        body: UpdateVoicemailBoxBodySchema,
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.update(req.params.id, user.tenant_id, req.body) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.post(
    '/:id/deactivate',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_VOICEMAIL_BOXES_DEACTIVATE),
      schema: { params: UuidParamsSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.deactivate(req.params.id, user.tenant_id) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );
};
