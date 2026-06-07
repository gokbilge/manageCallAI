import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { UuidParamsSchema } from '@managecallai/contracts';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { fireAuditEvent } from '../audit/fire-audit.js';
import { sendNotFound, sendFailedPrecondition } from '../../errors/index.js';
import { resolveActorIdentity } from '../auth/resolve-actor-identity.js';
import { LineAppearanceRepository } from './line-appearance.repository.js';
import {
  LineAppearanceService,
  LineAppearanceNotFoundError,
  AppearanceAssignmentNotFoundError,
} from './line-appearance.service.js';
import { EnterpriseLifecycleRepository } from '../shared/enterprise-lifecycle.repository.js';
import { EnterpriseLifecycleService, EnterpriseVersionNotFoundError, EnterpriseVersionStateError, EnterpriseRollbackNotAvailableError } from '../shared/enterprise-lifecycle.service.js';

const lifecycleSvc = new EnterpriseLifecycleService(new EnterpriseLifecycleRepository(db));
const service = new LineAppearanceService(new LineAppearanceRepository(db), lifecycleSvc);

const CreateLineAppearanceSchema = z.object({
  extension_id: z.string().uuid(),
  label: z.string().min(1).max(255),
  appearance_index: z.number().int().min(0).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const UpdateLineAppearanceSchema = z.object({
  label: z.string().min(1).max(255).optional(),
  appearance_index: z.number().int().min(0).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  metadata: z.record(z.unknown()).optional(),
});

function replyNotFound(err: unknown, reply: FastifyReply): void {
  if (err instanceof LineAppearanceNotFoundError || err instanceof AppearanceAssignmentNotFoundError || err instanceof EnterpriseVersionNotFoundError) {
    return sendNotFound(reply, (err as Error).message);
  }
  if (err instanceof EnterpriseVersionStateError || err instanceof EnterpriseRollbackNotAvailableError) {
    return sendFailedPrecondition(reply, (err as Error).message);
  }
  throw err;
}

// ── Line appearances (#314) ───────────────────────────────────────────────────
export const lineAppearanceController: FastifyPluginAsyncZod = async (app) => {
  app.get('/', {
    preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_VIEW),
    schema: { querystring: z.object({ extension_id: z.string().uuid().optional() }) },
  }, async (req) => {
    const user = req.user as AuthClaims;
    const { extension_id } = req.query as { extension_id?: string };
    return { data: await service.list(user.tenant_id, extension_id) };
  });

  app.post('/', {
    preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_CREATE),
    schema: { body: CreateLineAppearanceSchema },
  }, async (req, reply) => {
    const user = req.user as AuthClaims;
    const appearance = await service.create(user.tenant_id, req.body);
    fireAuditEvent({
      tenant_id: user.tenant_id, actor_id: user.sub, actor_role: user.role ?? null,
      action: 'line_appearance.created', resource_type: 'line_appearance', resource_id: appearance.id,
      metadata: { extension_id: appearance.extension_id, appearance_index: appearance.appearance_index },
    });
    return reply.code(201).send({ data: appearance });
  });

  app.get('/:id', {
    preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_VIEW),
    schema: { params: UuidParamsSchema },
  }, async (req, reply) => {
    try { return { data: await service.getById(req.params.id, (req.user as AuthClaims).tenant_id) }; }
    catch (err) { return replyNotFound(err, reply); }
  });

  app.patch('/:id', {
    preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_UPDATE),
    schema: { params: UuidParamsSchema, body: UpdateLineAppearanceSchema },
  }, async (req, reply) => {
    try { return { data: await service.update(req.params.id, (req.user as AuthClaims).tenant_id, req.body) }; }
    catch (err) { return replyNotFound(err, reply); }
  });

  app.delete('/:id', {
    preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_DEACTIVATE),
    schema: { params: UuidParamsSchema },
  }, async (req, reply) => {
    try { await service.delete(req.params.id, (req.user as AuthClaims).tenant_id); return reply.code(204).send(); }
    catch (err) { return replyNotFound(err, reply); }
  });

  // ── Device appearance assignments (#315) ──────────────────────────────────

  app.get('/:id/device-assignments', {
    preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_VIEW),
    schema: { params: UuidParamsSchema },
  }, async (req) => {
    return { data: await service.listByAppearance((req.user as AuthClaims).tenant_id, req.params.id) };
  });

  app.post('/:id/device-assignments', {
    preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_UPDATE),
    schema: {
      params: UuidParamsSchema,
      body: z.object({
        device_id: z.string().uuid(),
        button_index: z.number().int().min(0),
      }),
    },
  }, async (req, reply) => {
    const user = req.user as AuthClaims;
    const assignment = await service.assignToDevice(user.tenant_id, {
      device_id: req.body.device_id,
      line_appearance_id: req.params.id,
      button_index: req.body.button_index,
    });
    fireAuditEvent({
      tenant_id: user.tenant_id, actor_id: user.sub, actor_role: user.role ?? null,
      action: 'appearance.assigned_to_device', resource_type: 'device_appearance_assignment', resource_id: assignment.id,
      metadata: { device_id: req.body.device_id, line_appearance_id: req.params.id, button_index: req.body.button_index },
    });
    return reply.code(201).send({ data: assignment });
  });

  app.delete('/:id/device-assignments/:assignmentId', {
    preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_UPDATE),
    schema: { params: z.object({ id: z.string().uuid(), assignmentId: z.string().uuid() }) },
  }, async (req, reply) => {
    try { await service.removeFromDevice(req.params.assignmentId, (req.user as AuthClaims).tenant_id); return reply.code(204).send(); }
    catch (err) { return replyNotFound(err, reply); }
  });

  // ── Publish lifecycle (#319, #321) ────────────────────────────────────────

  const idVidParams = z.object({ id: z.string().uuid(), vid: z.string().uuid() });

  app.get('/:id/versions', { preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_VIEW), schema: { params: UuidParamsSchema } }, async (req, reply) => {
    try { return { data: await service.listVersions(req.params.id, (req.user as AuthClaims).tenant_id) }; } catch (err) { return replyNotFound(err, reply); }
  });

  app.post('/:id/versions', {
    preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_UPDATE),
    schema: { params: UuidParamsSchema, body: z.object({ definition: z.record(z.unknown()).optional() }) },
  }, async (req, reply) => {
    const user = req.user as AuthClaims;
    try { return reply.code(201).send({ data: await service.createVersion(req.params.id, user.tenant_id, req.body.definition ?? {}, user.sub) }); } catch (err) { return replyNotFound(err, reply); }
  });

  app.post('/:id/versions/:vid/validate', {
    preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_UPDATE),
    schema: { params: idVidParams },
  }, async (req, reply) => {
    try {
      const result = await service.validate(req.params.id, req.params.vid, (req.user as AuthClaims).tenant_id);
      return reply.code(result.outcome.status === 'passed' ? 200 : 422).send({ data: result });
    } catch (err) { return replyNotFound(err, reply); }
  });

  app.post('/:id/versions/:vid/simulate', {
    preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_VIEW),
    schema: { params: idVidParams, body: z.object({ scenario: z.record(z.unknown()).optional() }) },
  }, async (req, reply) => {
    try {
      const result = await service.simulate(req.params.id, req.params.vid, (req.user as AuthClaims).tenant_id, req.body.scenario ?? {});
      return reply.code((result.outcome.status as string) === 'passed' ? 200 : 422).send({ data: result });
    } catch (err) { return replyNotFound(err, reply); }
  });

  app.post('/:id/versions/:vid/publish', {
    preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_UPDATE),
    schema: { params: idVidParams },
  }, async (req, reply) => {
    resolveActorIdentity(req);
    const user = req.user as AuthClaims;
    try {
      const result = await service.publish(req.params.id, req.params.vid, user.tenant_id, user.sub);
      return reply.code(result.status === 'published' ? 200 : 202).send({ data: result });
    } catch (err) { return replyNotFound(err, reply); }
  });

  app.post('/:id/rollback', {
    preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_UPDATE),
    schema: { params: UuidParamsSchema },
  }, async (req, reply) => {
    resolveActorIdentity(req);
    const user = req.user as AuthClaims;
    try {
      const result = await service.rollback(req.params.id, user.tenant_id, user.sub);
      return reply.code(result.status === 'published' ? 200 : 202).send({ data: result });
    } catch (err) { return replyNotFound(err, reply); }
  });
};

// ── Device-side listing of appearance assignments (#315) ──────────────────────
export const deviceAppearanceController: FastifyPluginAsyncZod = async (app) => {
  app.get('/:id/appearance-assignments', {
    preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_VIEW),
    schema: { params: UuidParamsSchema },
  }, async (req) => {
    return { data: await service.listByDevice((req.user as AuthClaims).tenant_id, req.params.id) };
  });
};
