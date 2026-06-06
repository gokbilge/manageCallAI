import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { fireAuditEvent } from '../audit/fire-audit.js';
import { sendInvalidArgument, sendNotFound } from '../../errors/index.js';
import {
  CreateHolidayCalendarBodySchema,
  CreateScheduleBodySchema,
  CreateScheduleOverrideBodySchema,
  UpdateHolidayCalendarBodySchema,
  UpdateScheduleBodySchema,
  UpdateScheduleOverrideBodySchema,
  UuidParamsSchema,
} from '@managecallai/contracts';
import { ScheduleRepository } from './schedule.repository.js';
import {
  HolidayCalendarNotFoundError,
  ScheduleNotFoundError,
  ScheduleOverrideNotFoundError,
  ScheduleService,
  ScheduleValidationError,
} from './schedule.service.js';

const service = new ScheduleService(new ScheduleRepository(db));
const ScheduleScopedParamsSchema = z.object({ id: z.string().uuid(), childId: z.string().uuid() });

function replyError(err: unknown, reply: FastifyReply): void {
  if (
    err instanceof ScheduleNotFoundError
    || err instanceof HolidayCalendarNotFoundError
    || err instanceof ScheduleOverrideNotFoundError
  ) {
    return sendNotFound(reply, err.message);
  }
  if (err instanceof ScheduleValidationError) {
    return sendInvalidArgument(reply, err.message);
  }
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
      schema: { body: CreateScheduleBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const schedule = await service.create({ ...req.body, tenant_id: user.tenant_id });
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role ?? null,
          action: 'schedule_group.created',
          resource_type: 'schedule',
          resource_id: schedule.id,
          metadata: { timezone: schedule.timezone, weekly_rule_count: schedule.weekly_rules_json.length },
        });
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
      schema: { params: UuidParamsSchema, body: UpdateScheduleBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const schedule = await service.update(req.params.id, user.tenant_id, req.body);
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role ?? null,
          action: 'schedule_group.updated',
          resource_type: 'schedule',
          resource_id: schedule.id,
          metadata: { status: schedule.status },
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
      try {
        const schedule = await service.deactivate(req.params.id, user.tenant_id);
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role ?? null,
          action: 'schedule_group.deactivated',
          resource_type: 'schedule',
          resource_id: schedule.id,
          metadata: {},
        });
        return { data: schedule };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.get(
    '/:id/holiday-calendars',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_SCHEDULES_VIEW),
      schema: { params: UuidParamsSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.listHolidayCalendars(req.params.id, user.tenant_id) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.post(
    '/:id/holiday-calendars',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_SCHEDULES_UPDATE),
      schema: { params: UuidParamsSchema, body: CreateHolidayCalendarBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const calendar = await service.createHolidayCalendar({
          ...req.body,
          tenant_id: user.tenant_id,
          schedule_id: req.params.id,
        });
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role ?? null,
          action: 'holiday_calendar.created',
          resource_type: 'holiday_calendar',
          resource_id: calendar.id,
          metadata: { schedule_id: req.params.id, entry_count: calendar.entries_json.length },
        });
        return reply.code(201).send({ data: calendar });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.patch(
    '/:id/holiday-calendars/:childId',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_SCHEDULES_UPDATE),
      schema: { params: ScheduleScopedParamsSchema, body: UpdateHolidayCalendarBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const calendar = await service.updateHolidayCalendar(req.params.childId, req.params.id, user.tenant_id, req.body);
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role ?? null,
          action: 'holiday_calendar.updated',
          resource_type: 'holiday_calendar',
          resource_id: calendar.id,
          metadata: { schedule_id: req.params.id, status: calendar.status },
        });
        return { data: calendar };
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
      try {
        return { data: await service.listScheduleOverrides(req.params.id, user.tenant_id) };
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
      try {
        const override = await service.createScheduleOverride({
          ...req.body,
          tenant_id: user.tenant_id,
          schedule_id: req.params.id,
          created_by: user.sub,
        });
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role ?? null,
          action: 'schedule_override.created',
          resource_type: 'schedule_override',
          resource_id: override.id,
          metadata: {
            schedule_id: req.params.id,
            starts_at: override.starts_at,
            ends_at: override.ends_at,
            closed: override.closed,
          },
        });
        return reply.code(201).send({ data: override });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.patch(
    '/:id/overrides/:childId',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_SCHEDULES_UPDATE),
      schema: { params: ScheduleScopedParamsSchema, body: UpdateScheduleOverrideBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const override = await service.updateScheduleOverride(req.params.childId, req.params.id, user.tenant_id, req.body);
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role ?? null,
          action: 'schedule_override.updated',
          resource_type: 'schedule_override',
          resource_id: override.id,
          metadata: { schedule_id: req.params.id, status: override.status },
        });
        return { data: override };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.post(
    '/:id/overrides/:childId/cancel',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_SCHEDULES_UPDATE),
      schema: { params: ScheduleScopedParamsSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const override = await service.cancelScheduleOverride(
          req.params.childId,
          req.params.id,
          user.tenant_id,
          user.sub,
        );
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role ?? null,
          action: 'schedule_override.cancelled',
          resource_type: 'schedule_override',
          resource_id: override.id,
          metadata: { schedule_id: req.params.id, cancelled_at: override.cancelled_at },
        });
        return { data: override };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );
};
