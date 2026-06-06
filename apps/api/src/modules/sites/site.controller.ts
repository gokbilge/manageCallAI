import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { UuidParamsSchema } from '@managecallai/contracts';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { sendNotFound } from '../../errors/index.js';
import { SiteRepository } from './site.repository.js';
import { SiteService, SiteNotFoundError, SiteLocationNotFoundError } from './site.service.js';

const service = new SiteService(new SiteRepository(db));

const idLocParams = z.object({ id: z.string().uuid(), locId: z.string().uuid() });

const SiteBodySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  address_line1: z.string().optional(), address_line2: z.string().optional(),
  city: z.string().optional(), state_region: z.string().optional(),
  postal_code: z.string().optional(), country_code: z.string().max(10).optional(),
  timezone: z.string().max(100).optional(),
  language_code: z.string().max(20).optional(),
  network_zone: z.string().max(255).optional(),
  emergency_number: z.string().min(1).max(20).optional(),
  emergency_outbound_route_id: z.string().uuid().nullable().optional(),
  default_calling_policy_id: z.string().uuid().nullable().optional(),
  default_numbering_plan_id: z.string().uuid().nullable().optional(),
  default_outbound_route_id: z.string().uuid().nullable().optional(),
});

function replyError(err: unknown, reply: FastifyReply): void {
  if (err instanceof SiteNotFoundError || err instanceof SiteLocationNotFoundError) {
    return sendNotFound(reply, (err as Error).message);
  }
  throw err;
}

export const siteController: FastifyPluginAsyncZod = async (app) => {
  app.get('/', { preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_VIEW) }, async (req) => {
    const user = req.user as AuthClaims;
    return { data: await service.list(user.tenant_id) };
  });

  app.post('/', { preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_UPDATE), schema: { body: SiteBodySchema } }, async (req, reply) => {
    const user = req.user as AuthClaims;
    return reply.code(201).send({ data: await service.create(user.tenant_id, req.body) });
  });

  app.get('/:id', { preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_VIEW), schema: { params: UuidParamsSchema } }, async (req, reply) => {
    const user = req.user as AuthClaims;
    try { return { data: await service.getById(req.params.id, user.tenant_id) }; } catch (err) { return replyError(err, reply); }
  });

  app.patch('/:id', {
    preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_UPDATE),
    schema: { params: UuidParamsSchema, body: SiteBodySchema.partial().extend({ status: z.enum(['active','inactive']).optional() }) },
  }, async (req, reply) => {
    const user = req.user as AuthClaims;
    try { return { data: await service.update(req.params.id, user.tenant_id, req.body) }; } catch (err) { return replyError(err, reply); }
  });

  app.delete('/:id', { preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_UPDATE), schema: { params: UuidParamsSchema } }, async (req, reply) => {
    const user = req.user as AuthClaims;
    try { await service.delete(req.params.id, user.tenant_id); return reply.code(204).send(); } catch (err) { return replyError(err, reply); }
  });

  // Locations (#303)
  app.post('/:id/locations', {
    preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_UPDATE),
    schema: { params: UuidParamsSchema, body: z.object({ name: z.string().min(1).max(255), description: z.string().optional(), floor: z.string().optional(), room: z.string().optional() }) },
  }, async (req, reply) => {
    const user = req.user as AuthClaims;
    try { return reply.code(201).send({ data: await service.addLocation(req.params.id, user.tenant_id, req.body) }); } catch (err) { return replyError(err, reply); }
  });

  app.delete('/:id/locations/:locId', { preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_UPDATE), schema: { params: idLocParams } }, async (req, reply) => {
    const user = req.user as AuthClaims;
    try { await service.removeLocation(req.params.locId, req.params.id, user.tenant_id); return reply.code(204).send(); } catch (err) { return replyError(err, reply); }
  });
};
