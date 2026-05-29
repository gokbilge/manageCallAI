import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { ScheduleRepository } from './schedule.repository.js';
import { ScheduleNotFoundError, ScheduleService, ScheduleValidationError } from './schedule.service.js';
import { sendNotFound, sendInvalidArgument } from '../../errors/index.js';
import {
  UuidParamsSchema,
  CreateScheduleBodySchema,
  UpdateScheduleBodySchema,
} from '@managecallai/contracts';

const service = new ScheduleService(new ScheduleRepository(db));

function replyError(err: unknown, reply: FastifyReply): void {
  if (err instanceof ScheduleNotFoundError) return sendNotFound(reply, err.message);
  if (err instanceof ScheduleValidationError) return sendInvalidArgument(reply, err.message);
  throw err;
}

export const scheduleController: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/',
    { preHandler: requireCapability(CAPABILITIES.TENANT_SCHEDULES_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listByTenant(user.tenant_id) };
    },
  );

  app.post(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_SCHEDULES_CREATE),
      schema: {
        body: CreateScheduleBodySchema,
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const schedule = await service.create({ ...req.body, tenant_id: user.tenant_id });
        return reply.code(201).send({ data: schedule });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.get(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_SCHEDULES_VIEW),
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
      preHandler: requireCapability(CAPABILITIES.TENANT_SCHEDULES_UPDATE),
      schema: {
        params: UuidParamsSchema,
        body: UpdateScheduleBodySchema,
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
      preHandler: requireCapability(CAPABILITIES.TENANT_SCHEDULES_UPDATE),
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
