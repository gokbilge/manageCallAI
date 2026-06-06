import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { UuidParamsSchema } from '@managecallai/contracts';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { sendNotFound } from '../../errors/index.js';
import { CallingPolicyRepository } from './calling-policy.repository.js';
import { CallingPolicyService, CallingPolicyNotFoundError } from './calling-policy.service.js';

const service = new CallingPolicyService(new CallingPolicyRepository(db));

const PolicyAssignableTypeSchema = z.enum(['extension','call_group','tenant']);
const CallTypeSchema = z.enum(['local','national','mobile','international','premium_rate','emergency','toll_free','special']);

const ExceptionSchema = z.object({ type: z.enum(['allow','block']), prefix: z.string().min(1).max(50), reason: z.string().optional() });

const CreateBodySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  allow_local: z.boolean().optional(),
  allow_national: z.boolean().optional(),
  allow_mobile: z.boolean().optional(),
  allow_international: z.boolean().optional(),
  allow_premium_rate: z.boolean().optional(),
  allow_toll_free: z.boolean().optional(),
  allow_special: z.boolean().optional(),
  emergency_always_allowed: z.boolean().optional(),
  exceptions: z.array(ExceptionSchema).optional(),
});

function replyError(err: unknown, reply: FastifyReply): void {
  if (err instanceof CallingPolicyNotFoundError) return sendNotFound(reply, (err as Error).message);
  throw err;
}

export const callingPolicyController: FastifyPluginAsyncZod = async (app) => {
  app.get('/', { preHandler: requireCapability(CAPABILITIES.TENANT_FRAUD_POLICY_VIEW) }, async (req) => {
    const user = req.user as AuthClaims;
    return { data: await service.list(user.tenant_id) };
  });

  app.post('/', { preHandler: requireCapability(CAPABILITIES.TENANT_FRAUD_POLICY_MANAGE), schema: { body: CreateBodySchema } }, async (req, reply) => {
    const user = req.user as AuthClaims;
    return reply.code(201).send({ data: await service.create(user.tenant_id, req.body) });
  });

  app.get('/:id', { preHandler: requireCapability(CAPABILITIES.TENANT_FRAUD_POLICY_VIEW), schema: { params: UuidParamsSchema } }, async (req, reply) => {
    const user = req.user as AuthClaims;
    try { return { data: await service.getById(req.params.id, user.tenant_id) }; } catch (err) { return replyError(err, reply); }
  });

  app.patch('/:id', {
    preHandler: requireCapability(CAPABILITIES.TENANT_FRAUD_POLICY_MANAGE),
    schema: { params: UuidParamsSchema, body: CreateBodySchema.partial().extend({ status: z.enum(['active','inactive']).optional() }) },
  }, async (req, reply) => {
    const user = req.user as AuthClaims;
    try { return { data: await service.update(req.params.id, user.tenant_id, req.body) }; } catch (err) { return replyError(err, reply); }
  });

  app.delete('/:id', { preHandler: requireCapability(CAPABILITIES.TENANT_FRAUD_POLICY_MANAGE), schema: { params: UuidParamsSchema } }, async (req, reply) => {
    const user = req.user as AuthClaims;
    try { await service.delete(req.params.id, user.tenant_id); return reply.code(204).send(); } catch (err) { return replyError(err, reply); }
  });

  app.put('/:id/assignment', {
    preHandler: requireCapability(CAPABILITIES.TENANT_FRAUD_POLICY_MANAGE),
    schema: { params: UuidParamsSchema, body: z.object({ assignable_type: PolicyAssignableTypeSchema, assignable_id: z.string().uuid().nullable().optional() }) },
  }, async (req, reply) => {
    const user = req.user as AuthClaims;
    try { return { data: await service.assign(user.tenant_id, req.params.id, req.body.assignable_type, req.body.assignable_id ?? null) }; } catch (err) { return replyError(err, reply); }
  });

  // Call-type check against tenant policy (#302)
  app.post('/check', {
    preHandler: requireCapability(CAPABILITIES.TENANT_FRAUD_POLICY_VIEW),
    schema: { body: z.object({ call_type: CallTypeSchema }) },
  }, async (req) => {
    const user = req.user as AuthClaims;
    return { data: await service.checkCallType(user.tenant_id, req.body.call_type) };
  });
};
