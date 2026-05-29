import type { FastifyInstance, FastifyReply } from 'fastify';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { ChannelAccountRepository } from './channel-account.repository.js';
import { ChannelAccountNotFoundError, ChannelAccountService } from './channel-account.service.js';
import type { CreateChannelAccountInput, UpdateChannelAccountInput } from './channel-account.types.js';
import { sendNotFound } from '../../errors/index.js';

const service = new ChannelAccountService(new ChannelAccountRepository(db));

function replyNotFound(err: unknown, reply: FastifyReply): void {
  if (err instanceof ChannelAccountNotFoundError) {
    return sendNotFound(reply, err.message);
  }
  throw err;
}

const PROVIDER_TYPES = ['whatsapp', 'telegram', 'google_meet', 'custom'] as const;

export async function channelAccountController(app: FastifyInstance): Promise<void> {
  app.post<{ Body: Omit<CreateChannelAccountInput, 'tenant_id'> }>(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CHANNEL_ACCOUNTS_MANAGE),
      schema: {
        body: {
          type: 'object',
          required: ['provider_type', 'name'],
          additionalProperties: false,
          properties: {
            provider_type: { type: 'string', enum: [...PROVIDER_TYPES] },
            name: { type: 'string', minLength: 1, maxLength: 255 },
            capabilities: { type: 'array', items: { type: 'string', maxLength: 64 } },
            provider_config: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      const account = await service.create({ tenant_id: user.tenant_id, ...req.body });
      return reply.code(201).send({ data: account });
    },
  );

  app.get(
    '/',
    { preHandler: requireCapability(CAPABILITIES.TENANT_CHANNEL_ACCOUNTS_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listByTenant(user.tenant_id) };
    },
  );

  app.get<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CHANNEL_ACCOUNTS_VIEW),
      schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.getById(req.params.id, user.tenant_id) };
      } catch (err) {
        return replyNotFound(err, reply);
      }
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateChannelAccountInput }>(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CHANNEL_ACCOUNTS_MANAGE),
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          additionalProperties: false,
          minProperties: 1,
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            capabilities: { type: 'array', items: { type: 'string', maxLength: 64 } },
            provider_config: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.update(req.params.id, user.tenant_id, req.body) };
      } catch (err) {
        return replyNotFound(err, reply);
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    '/:id/deactivate',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CHANNEL_ACCOUNTS_MANAGE),
      schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.deactivate(req.params.id, user.tenant_id) };
      } catch (err) {
        return replyNotFound(err, reply);
      }
    },
  );
}
