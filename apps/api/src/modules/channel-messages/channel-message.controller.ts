import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  CreateOutboundMessageBodySchema,
} from '@managecallai/contracts';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { authenticateRuntime } from '../runtime/runtime-auth.js';
import { ChannelMessageRepository } from './channel-message.repository.js';
import { ChannelAccountInvalidError, ChannelMessageService } from './channel-message.service.js';
import { sendInvalidArgument } from '../../errors/index.js';

const service = new ChannelMessageService(new ChannelMessageRepository(db));

function replyError(err: unknown, reply: FastifyReply): void {
  if (err instanceof ChannelAccountInvalidError) {
    return sendInvalidArgument(reply, err.message);
  }
  throw err;
}

export const channelMessageController: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/accounts/:accountId/webhook',
    {
      preHandler: authenticateRuntime,
      schema: {
        params: z.object({ accountId: z.string() }),
        body: z.object({
          message_type: z.enum(['text', 'voice_message', 'meeting', 'image', 'document']),
          external_id: z.string().max(512).optional(),
          sender_id: z.string().max(255).optional(),
          recipient_id: z.string().max(255).optional(),
          body: z.string().max(10000).optional(),
          media_reference: z.string().max(2048).optional(),
          provider_metadata: z.record(z.unknown()).optional(),
          received_at: z.string().datetime().optional(),
        }),
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const msg = await service.ingestInbound({
          tenant_id: user.tenant_id,
          channel_account_id: req.params.accountId,
          ...req.body,
        });
        return reply.code(201).send({ data: msg });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.get(
    '/accounts/:accountId/messages',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CHANNEL_MESSAGES_VIEW),
      schema: { params: z.object({ accountId: z.string() }) },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listMessages(user.tenant_id, req.params.accountId) };
    },
  );

  app.post(
    '/requests',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CHANNEL_MESSAGES_SEND),
      schema: {
        body: CreateOutboundMessageBodySchema,
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const result = await service.createOutboundRequest({
          tenant_id: user.tenant_id,
          ...req.body,
        });
        return reply.code(201).send({ data: result });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.get(
    '/accounts/:accountId/requests',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CHANNEL_MESSAGES_VIEW),
      schema: { params: z.object({ accountId: z.string() }) },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listRequests(user.tenant_id, req.params.accountId) };
    },
  );
};
