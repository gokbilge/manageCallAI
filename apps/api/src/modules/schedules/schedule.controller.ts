import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { sendInvalidArgument, sendNotFound } from '../../errors/index.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { fireAuditEvent } from '../audit/fire-audit.js';
import { ScheduleRepository } from './schedule.repository.js';
import {
  HolidayCalendarNotFoundError,
  ScheduleConflictError,
  ScheduleGroupNotFoundError,
  ScheduleNotFoundError,
  ScheduleOverrideNotFoundError,
  ScheduleService,
  ScheduleValidationError,
} from './schedule.service.js';
import {
  CancelScheduleOverrideBodySchema,
  CreateHolidayCalendarBodySchema,
  CreateScheduleBodySchema,
  CreateScheduleGroupBodySchema,
  CreateScheduleOverrideBodySchema,
  UpdateHolidayCalendarBodySchema,
  UpdateScheduleBodySchema,
  UpdateScheduleGroupBodySchema,
  UuidParamsSchema,
} from '@managecallai/contracts';

const service = new ScheduleService(new ScheduleRepository(db));

const ScheduleOverrideParamsSchema = z.object({
  id: z.string().uuid(),
  overrideId: z.string().uuid(),
});

function replyError(err: unknown, reply: FastifyReply): void {
  if (
    err instanceof ScheduleNotFoundError
    || err instanceof ScheduleGroupNotFoundError
    || err instanceof HolidayCalendarNotFoundError
    || err instanceof ScheduleOverrideNotFoundError
  ) {
    return sendNotFound(reply, err.message);
  }
  if (err instanceof ScheduleValidationError || err instanceof ScheduleConflictError) {
    return sendInvalidArgument(reply, err.message);
  }
  throw err;
}

function audit(
  user: AuthClaims,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata?: Record<string, unknown>,
): void {
  fireAuditEvent({
    tenant_id: user.tenant_id,
    actor_id: user.sub,
    actor_role: user.role,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    metadata,
  });
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
      schema: { body: CreateScheduleBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      const body = req.body as z.infer<typeof CreateScheduleBodySchema>;
      try {
        const schedule = await service.create({ ...body, tenant_id: user.tenant_id });
        audit(user, 'schedule.created', 'schedule', schedule.id, {
          schedule_group_id: schedule.schedule_group_id,
          holiday_calendar_id: schedule.holiday_calendar_id,
        });
        return reply.code(201).send({ data: schedule });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.get(
    '/groups',
    { preHandler: requireCapability(CAPABILITIES.TENANT_SCHEDULES_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listScheduleGroups(user.tenant_id) };
    },
  );

  app.post(
    '/groups',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_SCHEDULES_CREATE),
      schema: { body: CreateScheduleGroupBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      const body = req.body as z.infer<typeof CreateScheduleGroupBodySchema>;
      try {
        const group = await service.createGroup({ ...body, tenant_id: user.tenant_id });
        audit(user, 'schedule_group.created', 'schedule_group', group.id);
        return reply.code(201).send({ data: group });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.patch(
    '/groups/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_SCHEDULES_UPDATE),
      schema: { params: UuidParamsSchema, body: UpdateScheduleGroupBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      const params = req.params as z.infer<typeof UuidParamsSchema>;
      const body = req.body as z.infer<typeof UpdateScheduleGroupBodySchema>;
      try {
        const group = await service.updateGroup(params.id, user.tenant_id, body);
        audit(user, 'schedule_group.updated', 'schedule_group', group.id);
        return { data: group };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.get(
    '/holiday-calendars',
    { preHandler: requireCapability(CAPABILITIES.TENANT_SCHEDULES_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listHolidayCalendars(user.tenant_id) };
    },
  );

  app.post(
    '/holiday-calendars',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_SCHEDULES_CREATE),
      schema: { body: CreateHolidayCalendarBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      const body = req.body as z.infer<typeof CreateHolidayCalendarBodySchema>;
      try {
        const calendar = await service.createHolidayCalendar({ ...body, tenant_id: user.tenant_id });
        audit(user, 'holiday_calendar.created', 'holiday_calendar', calendar.id);
        return reply.code(201).send({ data: calendar });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.patch(
    '/holiday-calendars/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_SCHEDULES_UPDATE),
      schema: { params: UuidParamsSchema, body: UpdateHolidayCalendarBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      const params = req.params as z.infer<typeof UuidParamsSchema>;
      const body = req.body as z.infer<typeof UpdateHolidayCalendarBodySchema>;
      try {
        const calendar = await service.updateHolidayCalendar(params.id, user.tenant_id, body);
        audit(user, 'holiday_calendar.updated', 'holiday_calendar', calendar.id);
        return { data: calendar };
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
      const params = req.params as z.infer<typeof UuidParamsSchema>;
      try {
        return { data: await service.getById(params.id, user.tenant_id) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.patch(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_SCHEDULES_UPDATE),
      schema: { params: UuidParamsSchema, body: UpdateScheduleBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      const params = req.params as z.infer<typeof UuidParamsSchema>;
      const body = req.body as z.infer<typeof UpdateScheduleBodySchema>;
      try {
        const schedule = await service.update(params.id, user.tenant_id, body);
        audit(user, 'schedule.updated', 'schedule', schedule.id, {
          schedule_group_id: schedule.schedule_group_id,
          holiday_calendar_id: schedule.holiday_calendar_id,
        });
        return { data: schedule };
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
      const params = req.params as z.infer<typeof UuidParamsSchema>;
      try {
        const schedule = await service.deactivate(params.id, user.tenant_id);
        audit(user, 'schedule.deactivated', 'schedule', schedule.id);
        return { data: schedule };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.get(
    '/:id/overrides',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_SCHEDULES_VIEW),
      schema: { params: UuidParamsSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      const params = req.params as z.infer<typeof UuidParamsSchema>;
      try {
        return { data: await service.listOverrides(params.id, user.tenant_id) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.post(
    '/:id/overrides',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_SCHEDULES_UPDATE),
      schema: { params: UuidParamsSchema, body: CreateScheduleOverrideBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      const params = req.params as z.infer<typeof UuidParamsSchema>;
      const body = req.body as z.infer<typeof CreateScheduleOverrideBodySchema>;
      try {
        const override = await service.createOverride({
          ...body,
          tenant_id: user.tenant_id,
          schedule_id: params.id,
          created_by: user.sub,
        });
        audit(user, 'schedule_override.created', 'schedule_override', override.id, {
          schedule_id: params.id,
          mode: override.mode,
          starts_at: override.starts_at,
          ends_at: override.ends_at,
        });
        return reply.code(201).send({ data: override });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.post(
    '/:id/overrides/:overrideId/cancel',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_SCHEDULES_UPDATE),
      schema: { params: ScheduleOverrideParamsSchema, body: CancelScheduleOverrideBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      const params = req.params as z.infer<typeof ScheduleOverrideParamsSchema>;
      const body = req.body as z.infer<typeof CancelScheduleOverrideBodySchema>;
      try {
        const override = await service.cancelOverride(params.id, params.overrideId, user.tenant_id, {
          ...body,
          cancelled_by: user.sub,
        });
        audit(user, 'schedule_override.cancelled', 'schedule_override', override.id, {
          schedule_id: params.id,
        });
        return { data: override };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );
};
