import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { QueueRepository } from './queue.repository.js';
import {
  QueueMemberInvalidError,
  QueueMemberNotFoundError,
  QueueNotFoundError,
  QueueService,
  QueueValidationError,
} from './queue.service.js';
import { sendNotFound, sendInvalidArgument } from '../../errors/index.js';
import {
  UuidParamsSchema,
  CreateQueueBodySchema,
  UpdateQueueBodySchema,
  AddQueueMemberBodySchema,
} from '@managecallai/contracts';

const service = new QueueService(new QueueRepository(db));

function replyError(err: unknown, reply: FastifyReply): void {
  if (err instanceof QueueNotFoundError || err instanceof QueueMemberNotFoundError) {
    return sendNotFound(reply, err.message);
  }
  if (err instanceof QueueMemberInvalidError || err instanceof QueueValidationError) {
    return sendInvalidArgument(reply, err.message);
  }
  throw err;
}

export const queueController: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/',
    { preHandler: requireCapability(CAPABILITIES.TENANT_QUEUES_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listByTenant(user.tenant_id) };
    },
  );

  app.post(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_QUEUES_CREATE),
      schema: {
        body: CreateQueueBodySchema,
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const queue = await service.create({ ...req.body, tenant_id: user.tenant_id });
        return reply.code(201).send({ data: queue });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.get(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_QUEUES_VIEW),
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
      preHandler: requireCapability(CAPABILITIES.TENANT_QUEUES_UPDATE),
      schema: {
        params: UuidParamsSchema,
        body: UpdateQueueBodySchema,
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
      preHandler: requireCapability(CAPABILITIES.TENANT_QUEUES_DEACTIVATE),
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

  app.post(
    '/:id/members',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_QUEUES_UPDATE),
      schema: {
        params: UuidParamsSchema,
        body: AddQueueMemberBodySchema,
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const member = await service.addMember(req.params.id, user.tenant_id, req.body);
        return reply.code(201).send({ data: member });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.delete(
    '/:id/members/:extensionId',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_QUEUES_UPDATE),
      schema: {
        params: z.object({ id: z.string().uuid(), extensionId: z.string().uuid() }),
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        await service.removeMember(req.params.id, req.params.extensionId, user.tenant_id);
        return reply.code(204).send();
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );
};
