import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { authenticate } from '../auth/authenticate.js';
import { authenticateRuntime } from '../runtime/runtime-auth.js';
import { fireAuditEvent } from '../audit/fire-audit.js';
import { sendNotFound, sendInvalidArgument, sendEntitlementLimitExceeded } from '../../errors/index.js';
import { entitlementSvc, EntitlementLimitExceededError } from '../entitlement/index.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { ParkingLotRepository } from './parking-lot.repository.js';
import {
  ParkingLotNotFoundError,
  ParkingService,
  ParkingSlotConflictError,
  ParkingSlotNotFoundError,
} from './parking-lot.service.js';

const repo = new ParkingLotRepository(db);
const service = new ParkingService(repo);

const UuidParam = z.object({ id: z.string().uuid() });

const CreateLotBodySchema = z.object({
  name: z.string().min(1).max(100),
  slot_range_start: z.number().int().min(1).max(9998).optional(),
  slot_range_end: z.number().int().min(2).max(9999).optional(),
  timeout_seconds: z.number().int().min(30).max(3600).optional(),
});

const UpdateLotBodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slot_range_start: z.number().int().min(1).max(9998).optional(),
  slot_range_end: z.number().int().min(2).max(9999).optional(),
  timeout_seconds: z.number().int().min(30).max(3600).optional(),
});

const ParkEventBodySchema = z.object({
  tenant_id: z.string().uuid(),
  slot: z.number().int().min(1),
  call_id: z.string().min(1),
  parked_by: z.string().nullable().optional(),
});

const RetrieveEventBodySchema = z.object({
  tenant_id: z.string().uuid(),
  slot: z.number().int().min(1),
});

const TimeoutEventBodySchema = z.object({
  tenant_id: z.string().uuid(),
  slot: z.number().int().min(1),
});

function handleError(err: unknown, reply: FastifyReply): void {
  if (err instanceof ParkingLotNotFoundError) {
    sendNotFound(reply, err.message);
    return;
  }
  if (err instanceof ParkingSlotConflictError || err instanceof ParkingSlotNotFoundError) {
    sendInvalidArgument(reply, err.message);
    return;
  }
  throw err;
}

export const parkingLotController: FastifyPluginAsyncZod = async (app) => {
  // ── Tenant-authenticated routes ───────────────────────────────────────────
  app.addHook('preHandler', authenticate);

  app.get('/', async (req) => {
    const user = req.user as AuthClaims;
    return { data: await service.listLots(user.tenant_id) };
  });

  app.post('/', { schema: { body: CreateLotBodySchema } }, async (req, reply) => {
    const user = req.user as AuthClaims;
    try {
      await entitlementSvc.assertWithinLimit(user.tenant_id, 'parking_lot.max_count');
    } catch (err) {
      if (err instanceof EntitlementLimitExceededError) return sendEntitlementLimitExceeded(reply, err);
      throw err;
    }
    const lot = await service.createLot({ ...req.body, tenant_id: user.tenant_id });
    fireAuditEvent({
      tenant_id: user.tenant_id,
      actor_id: user.sub,
      actor_role: user.role,
      action: 'parking_lot.created',
      resource_type: 'parking_lot',
      resource_id: lot.id,
    });
    return reply.code(201).send({ data: lot });
  });

  app.get('/:id', { schema: { params: UuidParam } }, async (req, reply) => {
    const user = req.user as AuthClaims;
    try {
      return { data: await service.getLotById(req.params.id, user.tenant_id) };
    } catch (err) {
      return handleError(err, reply);
    }
  });

  app.patch('/:id', { schema: { params: UuidParam, body: UpdateLotBodySchema } }, async (req, reply) => {
    const user = req.user as AuthClaims;
    try {
      const lot = await service.updateLot(req.params.id, user.tenant_id, req.body);
      fireAuditEvent({
        tenant_id: user.tenant_id,
        actor_id: user.sub,
        actor_role: user.role,
        action: 'parking_lot.updated',
        resource_type: 'parking_lot',
        resource_id: lot.id,
      });
      return { data: lot };
    } catch (err) {
      return handleError(err, reply);
    }
  });

  app.delete('/:id', { schema: { params: UuidParam } }, async (req, reply) => {
    const user = req.user as AuthClaims;
    try {
      await service.deleteLot(req.params.id, user.tenant_id);
      fireAuditEvent({
        tenant_id: user.tenant_id,
        actor_id: user.sub,
        actor_role: user.role,
        action: 'parking_lot.deleted',
        resource_type: 'parking_lot',
        resource_id: req.params.id,
      });
      return reply.code(204).send();
    } catch (err) {
      return handleError(err, reply);
    }
  });

  app.get('/:id/parked-calls', { schema: { params: UuidParam } }, async (req, reply) => {
    const user = req.user as AuthClaims;
    try {
      return { data: await service.listParkedCalls(req.params.id, user.tenant_id) };
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // ── Runtime callbacks (Go agent HMAC) ────────────────────────────────────
  // These routes are NOT protected by authenticate — they use authenticateRuntime.
  // The above addHook applies only to authenticated routes by prefix, but since
  // these are under the same plugin, we override preHandler.
};

// Separate plugin for runtime (no tenant auth)
export const parkingRuntimeController: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/parking/park',
    { preHandler: authenticateRuntime, schema: { body: ParkEventBodySchema } },
    async (req, reply) => {
      const { tenant_id, slot, call_id, parked_by } = req.body;
      try {
        const call = await service.recordPark(tenant_id, slot, call_id, parked_by);
        fireAuditEvent({
          tenant_id,
          actor_id: null,
          action: 'parking.parked',
          resource_type: 'parked_call',
          resource_id: call.id,
          metadata: { slot, call_id },
        });
        return reply.code(201).send({ data: call });
      } catch (err) {
        if (err instanceof ParkingSlotNotFoundError || err instanceof ParkingSlotConflictError) {
          return sendInvalidArgument(reply, (err as Error).message);
        }
        throw err;
      }
    },
  );

  app.post(
    '/parking/retrieve',
    { preHandler: authenticateRuntime, schema: { body: RetrieveEventBodySchema } },
    async (req, reply) => {
      const { tenant_id, slot } = req.body;
      try {
        const call = await service.recordRetrieve(tenant_id, slot);
        fireAuditEvent({
          tenant_id,
          actor_id: null,
          action: 'parking.retrieved',
          resource_type: 'parked_call',
          resource_id: call.id,
          metadata: { slot },
        });
        return { data: call };
      } catch (err) {
        if (err instanceof ParkingLotNotFoundError) {
          return sendNotFound(reply, (err as Error).message);
        }
        throw err;
      }
    },
  );

  app.post(
    '/parking/timeout',
    { preHandler: authenticateRuntime, schema: { body: TimeoutEventBodySchema } },
    async (req, reply) => {
      const { tenant_id, slot } = req.body;
      try {
        const call = await service.recordTimeout(tenant_id, slot);
        fireAuditEvent({
          tenant_id,
          actor_id: null,
          action: 'parking.timed_out',
          resource_type: 'parked_call',
          resource_id: call.id,
          metadata: { slot },
        });
        return { data: call };
      } catch (err) {
        if (err instanceof ParkingLotNotFoundError) {
          return sendNotFound(reply, (err as Error).message);
        }
        throw err;
      }
    },
  );
};
