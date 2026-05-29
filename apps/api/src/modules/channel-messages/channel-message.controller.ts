import type { FastifyInstance, FastifyReply } from 'fastify';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { authenticateRuntime } from '../runtime/runtime-auth.js';
import { ChannelMessageRepository } from './channel-message.repository.js';
import { ChannelAccountInvalidError, ChannelMessageService } from './channel-message.service.js';
import type { CreateOutboundMessageInput, IngestInboundMessageInput, MessageType } from './channel-message.types.js';

const service = new ChannelMessageService(new ChannelMessageRepository(db));

const MESSAGE_TYPES: MessageType[] = ['text', 'voice_message', 'meeting', 'image', 'document'];

function replyError(err: unknown, reply: FastifyReply): FastifyReply {
  if (err instanceof ChannelAccountInvalidError) {
    return reply.code(422).send({ error: err.message });
  }
  throw err;
}

export async function channelMessageController(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { accountId: string }; Body: Omit<IngestInboundMessageInput, 'tenant_id' | 'channel_account_id'> }>(
    '/accounts/:accountId/webhook',
    {
      preHandler: authenticateRuntime,
      schema: {
        params: { type: 'object', required: ['accountId'], properties: { accountId: { type: 'string' } } },
        body: {
          type: 'object',
          required: ['message_type'],
          additionalProperties: false,
          properties: {
            message_type: { type: 'string', enum: MESSAGE_TYPES },
            external_id: { type: 'string', maxLength: 512 },
            sender_id: { type: 'string', maxLength: 255 },
            recipient_id: { type: 'string', maxLength: 255 },
            body: { type: 'string', maxLength: 10000 },
            media_reference: { type: 'string', maxLength: 2048 },
            provider_metadata: { type: 'object', additionalProperties: true },
            received_at: { type: 'string', format: 'date-time' },
          },
        },
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

  app.get<{ Params: { accountId: string } }>(
    '/accounts/:accountId/messages',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CHANNEL_MESSAGES_VIEW),
      schema: { params: { type: 'object', required: ['accountId'], properties: { accountId: { type: 'string' } } } },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listMessages(user.tenant_id, req.params.accountId) };
    },
  );

  app.post<{ Body: Omit<CreateOutboundMessageInput, 'tenant_id'> }>(
    '/requests',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CHANNEL_MESSAGES_SEND),
      schema: {
        body: {
          type: 'object',
          required: ['channel_account_id', 'recipient_id', 'message_type'],
          additionalProperties: false,
          properties: {
            channel_account_id: { type: 'string' },
            recipient_id: { type: 'string', minLength: 1, maxLength: 255 },
            message_type: { type: 'string', enum: MESSAGE_TYPES },
            body: { type: 'string', maxLength: 10000 },
            media_reference: { type: 'string', maxLength: 2048 },
            provider_metadata: { type: 'object', additionalProperties: true },
          },
        },
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

  app.get<{ Params: { accountId: string } }>(
    '/accounts/:accountId/requests',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CHANNEL_MESSAGES_VIEW),
      schema: { params: { type: 'object', required: ['accountId'], properties: { accountId: { type: 'string' } } } },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listRequests(user.tenant_id, req.params.accountId) };
    },
  );
}
