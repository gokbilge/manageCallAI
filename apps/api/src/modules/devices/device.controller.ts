import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { UuidParamsSchema } from '@managecallai/contracts';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { authenticateRuntime } from '../runtime/runtime-auth.js';
import { fireAuditEvent } from '../audit/fire-audit.js';
import { sendNotFound } from '../../errors/index.js';
import { DeviceRepository } from './device.repository.js';
import { DeviceService, DeviceNotFoundError, DeviceAssignmentNotFoundError } from './device.service.js';

const service = new DeviceService(new DeviceRepository(db));

const DeviceTypeSchema = z.enum(['softphone','desk_phone','webrtc','mobile','other']);
const AssignableTypeSchema = z.enum(['user','device']);

const CreateDeviceSchema = z.object({
  name: z.string().min(1).max(255),
  device_type: DeviceTypeSchema.optional(),
  mac_address: z.string().max(17).optional(),
  sip_username: z.string().min(1).max(255).optional(),
  sip_password: z.string().min(8).max(255).optional(),
  metadata: z.record(z.unknown()).optional(),
});

function replyError(err: unknown, reply: FastifyReply): void {
  if (err instanceof DeviceNotFoundError || err instanceof DeviceAssignmentNotFoundError) {
    return sendNotFound(reply, (err as Error).message);
  }
  throw err;
}

export const deviceController: FastifyPluginAsyncZod = async (app) => {
  // ── Devices (#308) ────────────────────────────────────────────────────────

  app.get('/', { preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_VIEW) }, async (req) => {
    return { data: await service.list((req.user as AuthClaims).tenant_id) };
  });

  app.post('/', {
    preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_CREATE),
    schema: { body: CreateDeviceSchema },
  }, async (req, reply) => {
    const user = req.user as AuthClaims;
    const device = await service.create(user.tenant_id, req.body);
    fireAuditEvent({
      tenant_id: user.tenant_id, actor_id: user.sub, actor_role: user.role ?? null,
      action: 'device.created', resource_type: 'device', resource_id: device.id,
      metadata: { device_type: device.device_type },
    });
    return reply.code(201).send({ data: device });
  });

  app.get('/:id', {
    preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_VIEW),
    schema: { params: UuidParamsSchema },
  }, async (req, reply) => {
    try { return { data: await service.getById(req.params.id, (req.user as AuthClaims).tenant_id) }; } catch (err) { return replyError(err, reply); }
  });

  app.patch('/:id', {
    preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_UPDATE),
    schema: { params: UuidParamsSchema, body: CreateDeviceSchema.partial().extend({ status: z.enum(['active','inactive','deprovisioned']).optional() }) },
  }, async (req, reply) => {
    try { return { data: await service.update(req.params.id, (req.user as AuthClaims).tenant_id, req.body) }; } catch (err) { return replyError(err, reply); }
  });

  app.post('/:id/deprovision', {
    preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_DEACTIVATE),
    schema: { params: UuidParamsSchema },
  }, async (req, reply) => {
    const user = req.user as AuthClaims;
    try {
      const device = await service.deprovision(req.params.id, user.tenant_id);
      fireAuditEvent({ tenant_id: user.tenant_id, actor_id: user.sub, actor_role: user.role ?? null, action: 'device.deprovisioned', resource_type: 'device', resource_id: device.id, metadata: {} });
      return { data: device };
    } catch (err) { return replyError(err, reply); }
  });

  app.delete('/:id', {
    preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_DEACTIVATE),
    schema: { params: UuidParamsSchema },
  }, async (req, reply) => {
    try { await service.delete(req.params.id, (req.user as AuthClaims).tenant_id); return reply.code(204).send(); } catch (err) { return replyError(err, reply); }
  });

  // ── Registrations (#309) — operator views ─────────────────────────────────

  app.get('/:id/registrations', {
    preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_VIEW),
    schema: { params: UuidParamsSchema },
  }, async (req) => {
    return { data: await service.listRegistrations((req.user as AuthClaims).tenant_id, req.params.id) };
  });

  // ── Assignments (#310) ────────────────────────────────────────────────────

  app.get('/:id/assignments', {
    preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_VIEW),
    schema: { params: UuidParamsSchema },
  }, async (req) => {
    return { data: await service.listAssignmentsByAssignable((req.user as AuthClaims).tenant_id, 'device', req.params.id) };
  });
};

// ── Extension assignment controller (#310) ────────────────────────────────────
export const extensionAssignmentController: FastifyPluginAsyncZod = async (app) => {
  app.get('/:id/assignments', {
    preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_VIEW),
    schema: { params: UuidParamsSchema },
  }, async (req) => {
    return { data: await service.listAssignments((req.user as AuthClaims).tenant_id, req.params.id) };
  });

  app.post('/:id/assignments', {
    preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_UPDATE),
    schema: {
      params: UuidParamsSchema,
      body: z.object({
        assignable_type: AssignableTypeSchema,
        assignable_id: z.string().uuid(),
        is_primary: z.boolean().optional(),
      }),
    },
  }, async (req, reply) => {
    const user = req.user as AuthClaims;
    const assignment = await service.assign(user.tenant_id, {
      extension_id: req.params.id,
      assignable_type: req.body.assignable_type,
      assignable_id: req.body.assignable_id,
      is_primary: req.body.is_primary,
    });
    fireAuditEvent({
      tenant_id: user.tenant_id, actor_id: user.sub, actor_role: user.role ?? null,
      action: 'extension.assigned', resource_type: 'extension_assignment', resource_id: assignment.id,
      metadata: { extension_id: req.params.id, assignable_type: req.body.assignable_type, assignable_id: req.body.assignable_id },
    });
    return reply.code(201).send({ data: assignment });
  });

  app.delete('/:id/assignments/:assignmentId', {
    preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_UPDATE),
    schema: { params: z.object({ id: z.string().uuid(), assignmentId: z.string().uuid() }) },
  }, async (req, reply) => {
    try { await service.unassign(req.params.assignmentId, (req.user as AuthClaims).tenant_id); return reply.code(204).send(); } catch (err) {
      if (err instanceof DeviceAssignmentNotFoundError) return sendNotFound(reply, (err as Error).message);
      throw err;
    }
  });
};

// ── Registration recording controller — runtime path (#309) ──────────────────
export const deviceRegistrationController: FastifyPluginAsyncZod = async (app) => {
  app.post('/registrations', {
    preHandler: authenticateRuntime,
    schema: {
      body: z.object({
        tenant_id: z.string().uuid(),
        sip_username: z.string().min(1),
        device_id: z.string().uuid().nullable().optional(),
        extension_id: z.string().uuid().nullable().optional(),
        expires_at: z.string().datetime().nullable().optional(),
        contact_uri: z.string().nullable().optional(),
        user_agent: z.string().nullable().optional(),
        source_ip: z.string().nullable().optional(),
      }),
    },
  }, async (req, reply) => {
    const { tenant_id, ...rest } = req.body;
    const reg = await service.recordRegistration(tenant_id, rest);
    return reply.code(201).send({ data: reg });
  });

  app.get('/registrations', {
    preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_VIEW),
    schema: { querystring: z.object({ device_id: z.string().uuid().optional(), extension_id: z.string().uuid().optional() }) },
  }, async (req) => {
    const user = req.user as AuthClaims;
    const { device_id, extension_id } = req.query as { device_id?: string; extension_id?: string };
    return { data: await service.listRegistrations(user.tenant_id, device_id, extension_id) };
  });
};
