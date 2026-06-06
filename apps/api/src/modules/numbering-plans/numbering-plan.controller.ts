import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { UuidParamsSchema } from '@managecallai/contracts';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { sendNotFound } from '../../errors/index.js';
import { NumberingPlanRepository } from './numbering-plan.repository.js';
import {
  NumberingPlanService,
  NumberingPlanNotFoundError,
  NumberingRuleNotFoundError,
} from './numbering-plan.service.js';

const service = new NumberingPlanService(new NumberingPlanRepository(db));

const CallTypeSchema = z.enum(['local','national','mobile','international','premium_rate','emergency','toll_free','special']);
const AssignableTypeSchema = z.enum(['extension','sip_trunk','tenant']);

const idRuleParams = z.object({ id: z.string().uuid(), ruleId: z.string().uuid() });

function replyError(err: unknown, reply: FastifyReply): void {
  if (err instanceof NumberingPlanNotFoundError || err instanceof NumberingRuleNotFoundError) {
    return sendNotFound(reply, (err as Error).message);
  }
  throw err;
}

export const numberingPlanController: FastifyPluginAsyncZod = async (app) => {
  app.get('/', { preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_VIEW) }, async (req) => {
    const user = req.user as AuthClaims;
    return { data: await service.list(user.tenant_id) };
  });

  app.post('/', {
    preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_UPDATE),
    schema: { body: z.object({ name: z.string().min(1).max(255), description: z.string().optional(), country_code: z.string().max(10).optional() }) },
  }, async (req, reply) => {
    const user = req.user as AuthClaims;
    return reply.code(201).send({ data: await service.create(user.tenant_id, req.body) });
  });

  app.get('/:id', { preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_VIEW), schema: { params: UuidParamsSchema } }, async (req, reply) => {
    const user = req.user as AuthClaims;
    try { return { data: await service.getById(req.params.id, user.tenant_id) }; } catch (err) { return replyError(err, reply); }
  });

  app.patch('/:id', {
    preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_UPDATE),
    schema: { params: UuidParamsSchema, body: z.object({ name: z.string().optional(), description: z.string().nullable().optional(), country_code: z.string().nullable().optional(), status: z.enum(['active','inactive']).optional() }) },
  }, async (req, reply) => {
    const user = req.user as AuthClaims;
    try { return { data: await service.update(req.params.id, user.tenant_id, req.body) }; } catch (err) { return replyError(err, reply); }
  });

  app.delete('/:id', { preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_UPDATE), schema: { params: UuidParamsSchema } }, async (req, reply) => {
    const user = req.user as AuthClaims;
    try { await service.delete(req.params.id, user.tenant_id); return reply.code(204).send(); } catch (err) { return replyError(err, reply); }
  });

  // Rules
  app.post('/:id/rules', {
    preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_UPDATE),
    schema: { params: UuidParamsSchema, body: z.object({ name: z.string().min(1).max(255), pattern: z.string().min(1).max(500), call_type: CallTypeSchema, priority: z.number().int().min(1).max(9999).optional(), description: z.string().optional() }) },
  }, async (req, reply) => {
    const user = req.user as AuthClaims;
    try { return reply.code(201).send({ data: await service.addRule(req.params.id, user.tenant_id, req.body) }); } catch (err) { return replyError(err, reply); }
  });

  app.delete('/:id/rules/:ruleId', { preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_UPDATE), schema: { params: idRuleParams } }, async (req, reply) => {
    const user = req.user as AuthClaims;
    try { await service.removeRule(req.params.ruleId, req.params.id, user.tenant_id); return reply.code(204).send(); } catch (err) { return replyError(err, reply); }
  });

  // Assignments
  app.put('/:id/assignment', {
    preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_UPDATE),
    schema: { params: UuidParamsSchema, body: z.object({ assignable_type: AssignableTypeSchema, assignable_id: z.string().uuid().nullable().optional() }) },
  }, async (req, reply) => {
    const user = req.user as AuthClaims;
    try { return { data: await service.assign(user.tenant_id, req.params.id, req.body.assignable_type, req.body.assignable_id ?? null) }; } catch (err) { return replyError(err, reply); }
  });

  // Dial check (#302)
  app.post('/check', {
    preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_VIEW),
    schema: { body: z.object({ dial_string: z.string().min(1).max(50) }) },
  }, async (req) => {
    const user = req.user as AuthClaims;
    return { data: await service.checkDial(user.tenant_id, req.body.dial_string) };
  });
};
