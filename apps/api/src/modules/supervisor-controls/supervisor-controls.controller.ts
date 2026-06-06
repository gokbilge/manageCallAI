import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { sendNotFound, sendInvalidArgument } from '../../errors/index.js';
import {
  UuidParamsSchema,
  CreateSupervisorControlBodySchema,
  UpdateSupervisorControlBodySchema,
} from '@managecallai/contracts';
import { SupervisorControlsRepository } from './supervisor-controls.repository.js';
import {
  SupervisorControlNotFoundError,
  SupervisorControlTransitionError,
  SupervisorControlValidationError,
  SupervisorControlsService,
} from './supervisor-controls.service.js';

const service = new SupervisorControlsService(new SupervisorControlsRepository(db));

function replyError(err: unknown, reply: FastifyReply): void {
  if (err instanceof SupervisorControlNotFoundError) return sendNotFound(reply, err.message);
  if (err instanceof SupervisorControlValidationError || err instanceof SupervisorControlTransitionError) {
    return sendInvalidArgument(reply, err.message);
  }
  throw err;
}

export const supervisorControlsController: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/',
    { preHandler: requireCapability(CAPABILITIES.TENANT_SUPERVISOR_CONTROLS_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listByTenant(user.tenant_id) };
    },
  );

  app.post(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_SUPERVISOR_CONTROLS_MANAGE),
      schema: { body: CreateSupervisorControlBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const control = await service.create({
          ...req.body,
          tenant_id: user.tenant_id,
          supervisor_user_id: user.sub,
        });
        return reply.code(201).send({ data: control });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.get(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_SUPERVISOR_CONTROLS_VIEW),
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
      preHandler: requireCapability(CAPABILITIES.TENANT_SUPERVISOR_CONTROLS_MANAGE),
      schema: { params: UuidParamsSchema, body: UpdateSupervisorControlBodySchema },
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
    '/:id/end',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_SUPERVISOR_CONTROLS_MANAGE),
      schema: { params: UuidParamsSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.end(req.params.id, user.tenant_id) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );
};
