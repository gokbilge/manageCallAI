import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  CreateChannelAccountBodySchema,
  UpdateChannelAccountBodySchema,
  UuidParamsSchema,
} from '@managecallai/contracts';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { ChannelAccountRepository } from './channel-account.repository.js';
import { ChannelAccountNotFoundError, ChannelAccountService } from './channel-account.service.js';
import { sendNotFound } from '../../errors/index.js';

const service = new ChannelAccountService(new ChannelAccountRepository(db));

function replyNotFound(err: unknown, reply: FastifyReply): void {
  if (err instanceof ChannelAccountNotFoundError) {
    return sendNotFound(reply, err.message);
  }
  throw err;
}

export const channelAccountController: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CHANNEL_ACCOUNTS_MANAGE),
      schema: {
        body: CreateChannelAccountBodySchema,
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

  app.get(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CHANNEL_ACCOUNTS_VIEW),
      schema: { params: UuidParamsSchema },
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

  app.patch(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CHANNEL_ACCOUNTS_MANAGE),
      schema: {
        params: UuidParamsSchema,
        body: UpdateChannelAccountBodySchema,
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

  app.post(
    '/:id/deactivate',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CHANNEL_ACCOUNTS_MANAGE),
      schema: { params: UuidParamsSchema },
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
};
