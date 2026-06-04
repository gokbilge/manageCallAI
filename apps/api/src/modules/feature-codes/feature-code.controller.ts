import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { requireCapability } from '../auth/require-capability.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { authenticateRuntime } from '../runtime/runtime-auth.js';
import { fireAuditEvent } from '../audit/fire-audit.js';
import { sendNotFound, sendInvalidArgument } from '../../errors/index.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { FeatureCodeRepository } from './feature-code.repository.js';
import {
  FeatureCodeConflictError,
  FeatureCodeNotFoundError,
  FeatureCodeService,
  FeatureCodeStateError,
} from './feature-code.service.js';
import { FEATURE_CODE_ACTION_TYPES } from './feature-code.types.js';

const repo = new FeatureCodeRepository(db);
const service = new FeatureCodeService(repo);

const UuidParam = z.object({ id: z.string().uuid() });

const ActionTypeSchema = z.enum(FEATURE_CODE_ACTION_TYPES);

const CreateBodySchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  action_type: ActionTypeSchema,
  action_config: z.record(z.unknown()).optional(),
  requires_approval: z.boolean().optional(),
});

const UpdateBodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  action_type: ActionTypeSchema.optional(),
  action_config: z.record(z.unknown()).optional(),
  requires_approval: z.boolean().optional(),
});

// Runtime callback body — Lua executor posts this after a caller dials a feature code.
const RuntimeExecuteBodySchema = z.object({
  tenant_id: z.string().uuid(),
  call_id: z.string(),
  code: z.string(),
  caller_extension_id: z.string().uuid().optional(),
  dtmf_input: z.string().optional(),
});

function handleError(err: unknown, reply: FastifyReply): void {
  if (err instanceof FeatureCodeNotFoundError) {
    sendNotFound(reply, err.message);
    return;
  }
  if (err instanceof FeatureCodeConflictError || err instanceof FeatureCodeStateError) {
    sendInvalidArgument(reply, err.message);
    return;
  }
  throw err;
}

export const featureCodeController: FastifyPluginAsyncZod = async (app) => {
  // ── Authenticated tenant routes ─────────────────────────────────────────────
  app.get('/', { preHandler: requireCapability(CAPABILITIES.TENANT_FEATURE_CODES_VIEW) }, async (req) => {
    const user = req.user as AuthClaims;
    return { data: await service.list(user.tenant_id) };
  });

  app.post(
    '/',
    { preHandler: requireCapability(CAPABILITIES.TENANT_FEATURE_CODES_CREATE), schema: { body: CreateBodySchema } },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const fc = await service.create({
          ...req.body,
          tenant_id: user.tenant_id,
          created_by: user.sub,
        });
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role,
          action: 'feature_code.created',
          resource_type: 'feature_code',
          resource_id: fc.id,
          metadata: { code: fc.code, action_type: fc.action_type },
        });
        return reply.code(201).send({ data: fc });
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );

  app.get(
    '/:id',
    { preHandler: requireCapability(CAPABILITIES.TENANT_FEATURE_CODES_VIEW), schema: { params: UuidParam } },
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
    { preHandler: requireCapability(CAPABILITIES.TENANT_FEATURE_CODES_UPDATE), schema: { params: UuidParam, body: UpdateBodySchema } },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const fc = await service.update(req.params.id, user.tenant_id, req.body);
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role,
          action: 'feature_code.updated',
          resource_type: 'feature_code',
          resource_id: fc.id,
        });
        return { data: fc };
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );

  app.post(
    '/:id/publish',
    { preHandler: requireCapability(CAPABILITIES.TENANT_FEATURE_CODES_PUBLISH), schema: { params: UuidParam } },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const fc = await service.publish(req.params.id, user.tenant_id);
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role,
          action: 'feature_code.published',
          resource_type: 'feature_code',
          resource_id: fc.id,
          metadata: { code: fc.code, action_type: fc.action_type },
        });
        return { data: fc };
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );

  app.post(
    '/:id/disable',
    { preHandler: requireCapability(CAPABILITIES.TENANT_FEATURE_CODES_DEACTIVATE), schema: { params: UuidParam } },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const fc = await service.disable(req.params.id, user.tenant_id);
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role,
          action: 'feature_code.disabled',
          resource_type: 'feature_code',
          resource_id: fc.id,
        });
        return { data: fc };
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );

  app.post(
    '/:id/validate',
    { preHandler: requireCapability(CAPABILITIES.TENANT_FEATURE_CODES_VALIDATE), schema: { params: UuidParam } },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const result = await service.validate(req.params.id, user.tenant_id);
        return { data: result };
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );

  app.delete(
    '/:id',
    { preHandler: requireCapability(CAPABILITIES.TENANT_FEATURE_CODES_DEACTIVATE), schema: { params: UuidParam } },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        await service.delete(req.params.id, user.tenant_id);
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role,
          action: 'feature_code.deleted',
          resource_type: 'feature_code',
          resource_id: req.params.id,
        });
        return reply.code(204).send();
      } catch (err) {
        return handleError(err, reply);
      }
    },
  );

  // ── Runtime callback: Lua executor resolves a dialed feature code ───────────
  // Called by Lua thin executor when a caller dials a DTMF code matching the
  // feature code dialplan context. Returns the bounded action for Lua to execute.
  app.post(
    '/runtime/execute',
    {
      preHandler: authenticateRuntime,
      schema: { body: RuntimeExecuteBodySchema },
    },
    async (req, reply) => {
      const { tenant_id, call_id, code } = req.body;

      const fc = await service.resolveForRuntime(code, tenant_id);
      if (!fc) {
        return reply.code(404).send({ error: 'NOT_FOUND', message: `No active feature code: ${code}` });
      }

      fireAuditEvent({
        tenant_id,
        actor_id: null,
        action: 'feature_code.executed',
        resource_type: 'feature_code',
        resource_id: fc.id,
        metadata: { code, call_id, action_type: fc.action_type },
      });

      // Return the bounded action for the Lua executor.
      // The executor only acts on known action types.
      return {
        data: {
          feature_code_id: fc.id,
          action_type: fc.action_type,
          action_config: fc.action_config,
        },
      };
    },
  );
};
