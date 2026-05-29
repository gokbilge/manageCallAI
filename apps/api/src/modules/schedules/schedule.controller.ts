import type { FastifyInstance, FastifyReply } from 'fastify';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { ScheduleRepository } from './schedule.repository.js';
import { ScheduleNotFoundError, ScheduleService, ScheduleValidationError } from './schedule.service.js';
import type { CreateScheduleInput, UpdateScheduleInput } from './schedule.types.js';

const service = new ScheduleService(new ScheduleRepository(db));

function replyError(err: unknown, reply: FastifyReply): FastifyReply {
  if (err instanceof ScheduleNotFoundError) return reply.code(404).send({ error: err.message });
  if (err instanceof ScheduleValidationError) return reply.code(422).send({ error: err.message });
  throw err;
}

export async function scheduleController(app: FastifyInstance): Promise<void> {
  app.get(
    '/',
    { preHandler: requireCapability(CAPABILITIES.TENANT_SCHEDULES_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listByTenant(user.tenant_id) };
    },
  );

  app.post<{ Body: Omit<CreateScheduleInput, 'tenant_id'> }>(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_SCHEDULES_CREATE),
      schema: {
        body: {
          type: 'object',
          required: ['name', 'timezone'],
          additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            timezone: { type: 'string', minLength: 1 },
            weekly_rules_json: { type: 'array' },
            holiday_overrides_json: { type: 'array' },
          },
        },
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

  app.get<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_SCHEDULES_VIEW),
      schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
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

  app.patch<{ Params: { id: string }; Body: UpdateScheduleInput }>(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_SCHEDULES_UPDATE),
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            timezone: { type: 'string', minLength: 1 },
            weekly_rules_json: { type: 'array' },
            holiday_overrides_json: { type: 'array' },
            status: { type: 'string', enum: ['active', 'inactive'] },
          },
        },
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

  app.post<{ Params: { id: string } }>(
    '/:id/deactivate',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_SCHEDULES_UPDATE),
      schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
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
}
