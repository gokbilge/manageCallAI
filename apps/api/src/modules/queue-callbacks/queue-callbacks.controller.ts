import { z } from 'zod';
import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { sendNotFound, sendInvalidArgument } from '../../errors/index.js';
import {
  UuidParamsSchema,
  CreateQueueCallbackBodySchema,
  UpdateQueueCallbackBodySchema,
} from '@managecallai/contracts';
import { QueueCallbacksRepository } from './queue-callbacks.repository.js';
import {
  QueueCallbackNotFoundError,
  QueueCallbackTransitionError,
  QueueCallbackValidationError,
  QueueCallbacksService,
} from './queue-callbacks.service.js';

const service = new QueueCallbacksService(new QueueCallbacksRepository(db));

function replyError(err: unknown, reply: FastifyReply): void {
  if (err instanceof QueueCallbackNotFoundError) return sendNotFound(reply, err.message);
  if (err instanceof QueueCallbackValidationError || err instanceof QueueCallbackTransitionError) {
    return sendInvalidArgument(reply, err.message);
  }
  throw err;
}

// Tenant-level: GET /queue-callbacks (all callbacks for tenant)
export const queueCallbackController: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/',
    { preHandler: requireCapability(CAPABILITIES.TENANT_QUEUE_CALLBACKS_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listByTenant(user.tenant_id) };
    },
  );

  app.get(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_QUEUE_CALLBACKS_VIEW),
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
      preHandler: requireCapability(CAPABILITIES.TENANT_QUEUE_CALLBACKS_MANAGE),
      schema: { params: UuidParamsSchema, body: UpdateQueueCallbackBodySchema },
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
    '/:id/cancel',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_QUEUE_CALLBACKS_MANAGE),
      schema: { params: UuidParamsSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.cancel(req.params.id, user.tenant_id) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );
};

// Queue-scoped: POST/GET /queues/:id/callbacks
export const queueScopedCallbackController: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/:id/callbacks',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_QUEUE_CALLBACKS_VIEW),
      schema: { params: z.object({ id: z.string().uuid() }) },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listByQueue(req.params.id, user.tenant_id) };
    },
  );

  app.post(
    '/:id/callbacks',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_QUEUE_CALLBACKS_MANAGE),
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: CreateQueueCallbackBodySchema,
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const cb = await service.create(req.params.id, {
          ...req.body,
          tenant_id: user.tenant_id,
          queue_id: req.params.id,
        });
        return reply.code(201).send({ data: cb });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );
};
