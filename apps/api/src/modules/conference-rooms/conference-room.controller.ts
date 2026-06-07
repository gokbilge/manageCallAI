import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { authenticateRuntime } from '../runtime/runtime-auth.js';
import { fireAuditEvent } from '../audit/fire-audit.js';
import { sendNotFound, sendEntitlementLimitExceeded } from '../../errors/index.js';
import { entitlementSvc, EntitlementLimitExceededError } from '../entitlement/index.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { ConferenceRoomRepository } from './conference-room.repository.js';
import { ConferenceRoomNotFoundError, ConferenceService } from './conference-room.service.js';

const repo = new ConferenceRoomRepository(db);
const service = new ConferenceService(repo);

const UuidParam = z.object({ id: z.string().uuid() });

const CreateBodySchema = z.object({
  name: z.string().min(1).max(100),
  room_number: z.string().min(1).max(20).regex(/^\d+$/, 'room_number must be numeric'),
  pin: z.string().min(4).max(20).nullable().optional(),
  max_participants: z.number().int().min(2).max(200).optional(),
  record_calls: z.boolean().optional(),
});

const UpdateBodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  pin: z.string().min(4).max(20).nullable().optional(),
  max_participants: z.number().int().min(2).max(200).optional(),
  record_calls: z.boolean().optional(),
});

const RuntimeJoinBodySchema = z.object({
  tenant_id: z.string().uuid(),
  conference_room_id: z.string().uuid(),
  call_id: z.string().min(1),
});

function handleError(err: unknown, reply: FastifyReply): void {
  if (err instanceof ConferenceRoomNotFoundError) {
    sendNotFound(reply, err.message);
    return;
  }
  throw err;
}

export const conferenceRoomController: FastifyPluginAsyncZod = async (app) => {
  app.get('/', { preHandler: requireCapability(CAPABILITIES.TENANT_CONFERENCE_ROOMS_VIEW) }, async (req) => {
    const user = req.user as AuthClaims;
    return { data: await service.list(user.tenant_id) };
  });

  app.post(
    '/',
    { preHandler: requireCapability(CAPABILITIES.TENANT_CONFERENCE_ROOMS_CREATE), schema: { body: CreateBodySchema } },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        await entitlementSvc.assertWithinLimit(user.tenant_id, 'conference_room.max_count');
      } catch (err) {
        if (err instanceof EntitlementLimitExceededError) return sendEntitlementLimitExceeded(reply, err);
        throw err;
      }
      const room = await service.create({ ...req.body, tenant_id: user.tenant_id, created_by: user.sub });
      fireAuditEvent({
        tenant_id: user.tenant_id,
        actor_id: user.sub,
        actor_role: user.role,
        action: 'conference_room.created',
        resource_type: 'conference_room',
        resource_id: room.id,
      });
      return reply.code(201).send({ data: room });
    },
  );

  app.get(
    '/:id',
    { preHandler: requireCapability(CAPABILITIES.TENANT_CONFERENCE_ROOMS_VIEW), schema: { params: UuidParam } },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.getById(req.params.id, user.tenant_id) };
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );

  app.patch(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CONFERENCE_ROOMS_UPDATE),
      schema: { params: UuidParam, body: UpdateBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const room = await service.update(req.params.id, user.tenant_id, req.body);
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role,
          action: 'conference_room.updated',
          resource_type: 'conference_room',
          resource_id: room.id,
        });
        return { data: room };
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );

  app.post(
    '/:id/disable',
    { preHandler: requireCapability(CAPABILITIES.TENANT_CONFERENCE_ROOMS_DEACTIVATE), schema: { params: UuidParam } },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const room = await service.disable(req.params.id, user.tenant_id);
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role,
          action: 'conference_room.disabled',
          resource_type: 'conference_room',
          resource_id: room.id,
        });
        return { data: room };
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );

  app.post(
    '/:id/enable',
    { preHandler: requireCapability(CAPABILITIES.TENANT_CONFERENCE_ROOMS_UPDATE), schema: { params: UuidParam } },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const room = await service.enable(req.params.id, user.tenant_id);
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role,
          action: 'conference_room.enabled',
          resource_type: 'conference_room',
          resource_id: room.id,
        });
        return { data: room };
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );

  app.delete(
    '/:id',
    { preHandler: requireCapability(CAPABILITIES.TENANT_CONFERENCE_ROOMS_DEACTIVATE), schema: { params: UuidParam } },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        await service.delete(req.params.id, user.tenant_id);
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role,
          action: 'conference_room.deleted',
          resource_type: 'conference_room',
          resource_id: req.params.id,
        });
        return reply.code(204).send();
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );

  app.get(
    '/:id/participants',
    { preHandler: requireCapability(CAPABILITIES.TENANT_CONFERENCE_ROOMS_VIEW), schema: { params: UuidParam } },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.listParticipants(req.params.id, user.tenant_id) };
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );
};

// Runtime callbacks from Go agent (conference join/leave events)
export const conferenceRuntimeController: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/conference/joined',
    { preHandler: authenticateRuntime, schema: { body: RuntimeJoinBodySchema } },
    async (req) => {
      const { tenant_id, conference_room_id, call_id } = req.body;
      const participant = await service.recordJoin(tenant_id, conference_room_id, call_id);
      fireAuditEvent({
        tenant_id,
        actor_id: null,
        action: 'conference.participant_joined',
        resource_type: 'conference_room',
        resource_id: conference_room_id,
        metadata: { call_id },
      });
      return { data: participant };
    },
  );

  app.post(
    '/conference/left',
    { preHandler: authenticateRuntime, schema: { body: RuntimeJoinBodySchema } },
    async (req) => {
      const { tenant_id, conference_room_id, call_id } = req.body;
      const participant = await service.recordLeave(tenant_id, conference_room_id, call_id);
      if (!participant) {
        return { data: null };
      }
      fireAuditEvent({
        tenant_id,
        actor_id: null,
        action: 'conference.participant_left',
        resource_type: 'conference_room',
        resource_id: conference_room_id,
        metadata: { call_id },
      });
      return { data: participant };
    },
  );
};
