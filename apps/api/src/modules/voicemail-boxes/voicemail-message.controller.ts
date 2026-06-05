import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { sendFailedPrecondition, sendNotFound, sendPermissionDenied } from '../../errors/index.js';
import { CAPABILITIES, hasCapability } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { ResourceInactiveError, TenantScopeError } from '../domain-assertions.js';
import { authenticateRuntime } from '../runtime/runtime-auth.js';
import { config } from '../../config/env.js';
import { RecordingService } from '../recordings/recording.service.js';
import { RecordingRepository } from '../recordings/recording.repository.js';
import { SummaryReviewSchema } from '@managecallai/contracts';
import { VoicemailMessageRepository } from './voicemail-message.repository.js';
import {
  VoicemailMailboxNotFoundError,
  VoicemailMessageNotFoundError,
  VoicemailMessageService,
} from './voicemail-message.service.js';

const service = new VoicemailMessageService(new VoicemailMessageRepository(db));
const recordingService = new RecordingService(new RecordingRepository(db), config.recordingStorageRoot);

const UuidParams = z.object({ id: z.string().uuid() });
const BoxUuidParams = z.object({ boxId: z.string().uuid() });

function handleVoicemailMessageError(err: unknown, reply: FastifyReply): void {
  if (err instanceof VoicemailMessageNotFoundError || err instanceof VoicemailMailboxNotFoundError) {
    return sendNotFound(reply, err.message);
  }
  if (err instanceof TenantScopeError) {
    return sendPermissionDenied(reply, err.message);
  }
  if (err instanceof ResourceInactiveError) {
    return sendFailedPrecondition(reply, err.message);
  }
  throw err;
}

function canViewTranscript(user: AuthClaims): boolean {
  if (user.capabilities !== undefined) {
    return user.capabilities.includes('*') || user.capabilities.includes(CAPABILITIES.TENANT_COMPLIANCE_ADMIN);
  }
  return hasCapability(user.role, CAPABILITIES.TENANT_COMPLIANCE_ADMIN);
}

export const voicemailMessageController: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/:boxId/messages',
    {
      preHandler: authenticateRuntime,
      schema: {
        params: BoxUuidParams,
        body: z.object({
          tenant_id: z.string().uuid(),
          call_id: z.string().min(1),
          storage_path: z.string().min(1),
          duration_secs: z.number().int().optional(),
          size_bytes: z.number().int().optional(),
        }),
      },
    },
    async (req, reply) => {
      try {
        const message = await service.ingest({
          ...req.body,
          voicemail_box_id: req.params.boxId,
        });
        return reply.code(201).send({ data: message });
      } catch (err) {
        return handleVoicemailMessageError(err, reply);
      }
    },
  );

  app.get(
    '/:boxId/messages',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_VOICEMAIL_BOXES_VIEW),
      schema: {
        params: BoxUuidParams,
        querystring: z.object({
          unread_only: z.enum(['true', 'false']).default('false'),
          limit: z.coerce.number().int().min(1).max(200).default(50),
        }),
      },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      return {
        data: await service.listByMailbox(user.tenant_id, req.params.boxId, {
          unreadOnly: req.query.unread_only === 'true',
          limit: req.query.limit,
        }),
      };
    },
  );

  app.get(
    '/messages/:id/summary-review',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_VOICEMAIL_BOXES_VIEW),
      schema: {
        params: UuidParams,
        response: { 200: z.object({ data: SummaryReviewSchema }) },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const message = await service.getById(req.params.id, user.tenant_id);
        return {
          data: await recordingService.getSummaryReviewForVoicemail(message.id, message.call_id, user.tenant_id, {
            canViewTranscript: canViewTranscript(user),
          }),
        };
      } catch (err) {
        return handleVoicemailMessageError(err, reply);
      }
    },
  );

  app.post(
    '/messages/:id/read',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_VOICEMAIL_BOXES_VIEW),
      schema: { params: UuidParams },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.markRead(req.params.id, user.tenant_id) };
      } catch (err) {
        return handleVoicemailMessageError(err, reply);
      }
    },
  );

  app.delete(
    '/messages/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_VOICEMAIL_BOXES_UPDATE),
      schema: { params: UuidParams },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        await service.delete(req.params.id, user.tenant_id);
        return reply.code(204).send();
      } catch (err) {
        return handleVoicemailMessageError(err, reply);
      }
    },
  );
};
