import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { UuidParamsSchema } from '@managecallai/contracts';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { resolveActorIdentity } from '../auth/resolve-actor-identity.js';
import { sendNotFound, sendFailedPrecondition } from '../../errors/index.js';
import { TrunkGroupRepository } from './trunk-group.repository.js';
import {
  TrunkGroupService,
  TrunkGroupNotFoundError,
  RouteListNotFoundError,
  TrunkGroupMemberNotFoundError,
} from './trunk-group.service.js';
import { EnterpriseLifecycleRepository } from '../shared/enterprise-lifecycle.repository.js';
import { EnterpriseLifecycleService, EnterpriseVersionNotFoundError, EnterpriseVersionStateError, EnterpriseRollbackNotAvailableError } from '../shared/enterprise-lifecycle.service.js';

const lifecycleSvc = new EnterpriseLifecycleService(new EnterpriseLifecycleRepository(db));
const service = new TrunkGroupService(new TrunkGroupRepository(db), lifecycleSvc);

const idMemberParams = z.object({ id: z.string().uuid(), memberId: z.string().uuid() });
const idEntryParams = z.object({ id: z.string().uuid(), entryId: z.string().uuid() });
const SelectionStrategySchema = z.enum(['priority', 'round_robin', 'weight']);
const EntryTypeSchema = z.enum(['sip_trunk', 'trunk_group', 'outbound_route']);

function replyError(err: unknown, reply: FastifyReply): void {
  if (
    err instanceof TrunkGroupNotFoundError ||
    err instanceof RouteListNotFoundError ||
    err instanceof TrunkGroupMemberNotFoundError ||
    err instanceof EnterpriseVersionNotFoundError
  ) {
    return sendNotFound(reply, (err as Error).message);
  }
  if (err instanceof EnterpriseVersionStateError || err instanceof EnterpriseRollbackNotAvailableError) {
    return sendFailedPrecondition(reply, (err as Error).message);
  }
  throw err;
}

export const trunkGroupController: FastifyPluginAsyncZod = async (app) => {
  // ── Trunk groups (#305) ───────────────────────────────────────────────────

  app.get('/', { preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_VIEW) }, async (req) => {
    return { data: await service.listGroups((req.user as AuthClaims).tenant_id) };
  });

  app.post('/', {
    preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_UPDATE),
    schema: { body: z.object({ name: z.string().min(1).max(255), description: z.string().optional(), selection_strategy: SelectionStrategySchema.optional() }) },
  }, async (req, reply) => {
    return reply.code(201).send({ data: await service.createGroup((req.user as AuthClaims).tenant_id, req.body) });
  });

  app.get('/:id', { preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_VIEW), schema: { params: UuidParamsSchema } }, async (req, reply) => {
    try { return { data: await service.getGroupById(req.params.id, (req.user as AuthClaims).tenant_id) }; } catch (err) { return replyError(err, reply); }
  });

  app.patch('/:id', {
    preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_UPDATE),
    schema: { params: UuidParamsSchema, body: z.object({ name: z.string().optional(), description: z.string().nullable().optional(), selection_strategy: SelectionStrategySchema.optional(), status: z.enum(['active','inactive']).optional() }) },
  }, async (req, reply) => {
    try { return { data: await service.updateGroup(req.params.id, (req.user as AuthClaims).tenant_id, req.body) }; } catch (err) { return replyError(err, reply); }
  });

  app.delete('/:id', { preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_UPDATE), schema: { params: UuidParamsSchema } }, async (req, reply) => {
    try { await service.deleteGroup(req.params.id, (req.user as AuthClaims).tenant_id); return reply.code(204).send(); } catch (err) { return replyError(err, reply); }
  });

  app.post('/:id/members', {
    preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_UPDATE),
    schema: { params: UuidParamsSchema, body: z.object({ trunk_id: z.string().uuid(), priority: z.number().int().min(1).max(9999).optional(), weight: z.number().int().min(1).optional() }) },
  }, async (req, reply) => {
    try { return reply.code(201).send({ data: await service.addMember(req.params.id, (req.user as AuthClaims).tenant_id, req.body) }); } catch (err) { return replyError(err, reply); }
  });

  app.delete('/:id/members/:memberId', { preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_UPDATE), schema: { params: idMemberParams } }, async (req, reply) => {
    try { await service.removeMember(req.params.memberId, req.params.id, (req.user as AuthClaims).tenant_id); return reply.code(204).send(); } catch (err) { return replyError(err, reply); }
  });

  // Failover-aware simulation (#306)
  app.post('/:id/simulate', {
    preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_VIEW),
    schema: { params: UuidParamsSchema, body: z.object({ dial_string: z.string().min(1).max(50) }) },
  }, async (req, reply) => {
    try { return { data: await service.simulateTrunkGroup(req.params.id, (req.user as AuthClaims).tenant_id, req.body.dial_string) }; } catch (err) { return replyError(err, reply); }
  });

  // ── Publish lifecycle (#319, #321) ────────────────────────────────────────

  const idVidParams = z.object({ id: z.string().uuid(), vid: z.string().uuid() });

  app.get('/:id/versions', { preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_VIEW), schema: { params: UuidParamsSchema } }, async (req, reply) => {
    try { return { data: await service.listVersions(req.params.id, (req.user as AuthClaims).tenant_id) }; } catch (err) { return replyError(err, reply); }
  });

  app.post('/:id/versions', {
    preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_UPDATE),
    schema: { params: UuidParamsSchema, body: z.object({ definition: z.record(z.unknown()).optional() }) },
  }, async (req, reply) => {
    const user = req.user as AuthClaims;
    try {
      return reply.code(201).send({ data: await service.createVersion(req.params.id, user.tenant_id, req.body.definition ?? {}, user.sub) });
    } catch (err) { return replyError(err, reply); }
  });

  app.post('/:id/versions/:vid/validate', {
    preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_UPDATE),
    schema: { params: idVidParams },
  }, async (req, reply) => {
    try {
      const result = await service.validate(req.params.id, req.params.vid, (req.user as AuthClaims).tenant_id);
      return reply.code(result.outcome.status === 'passed' ? 200 : 422).send({ data: result });
    } catch (err) { return replyError(err, reply); }
  });

  app.post('/:id/versions/:vid/simulate', {
    preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_VIEW),
    schema: { params: idVidParams, body: z.object({ dial_string: z.string().min(1).max(50) }) },
  }, async (req, reply) => {
    try {
      const result = await service.simulate(req.params.id, req.params.vid, (req.user as AuthClaims).tenant_id, req.body.dial_string);
      return reply.code((result.outcome.status as string) === 'passed' ? 200 : 422).send({ data: result });
    } catch (err) { return replyError(err, reply); }
  });

  app.post('/:id/versions/:vid/publish', {
    preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_ACTIVATE),
    schema: { params: idVidParams },
  }, async (req, reply) => {
    resolveActorIdentity(req);
    const user = req.user as AuthClaims;
    try {
      const result = await service.publish(req.params.id, req.params.vid, user.tenant_id, user.sub);
      return reply.code(result.status === 'published' ? 200 : 202).send({ data: result });
    } catch (err) { return replyError(err, reply); }
  });

  app.post('/:id/rollback', {
    preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_ACTIVATE),
    schema: { params: UuidParamsSchema },
  }, async (req, reply) => {
    resolveActorIdentity(req);
    const user = req.user as AuthClaims;
    try {
      const result = await service.rollback(req.params.id, user.tenant_id, user.sub);
      return reply.code(result.status === 'published' ? 200 : 202).send({ data: result });
    } catch (err) { return replyError(err, reply); }
  });
};

export const routeListController: FastifyPluginAsyncZod = async (app) => {
  // ── Route lists (#305) ────────────────────────────────────────────────────

  app.get('/', { preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_VIEW) }, async (req) => {
    return { data: await service.listRouteLists((req.user as AuthClaims).tenant_id) };
  });

  app.post('/', {
    preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_UPDATE),
    schema: { body: z.object({ name: z.string().min(1).max(255), description: z.string().optional() }) },
  }, async (req, reply) => {
    return reply.code(201).send({ data: await service.createRouteList((req.user as AuthClaims).tenant_id, req.body) });
  });

  app.get('/:id', { preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_VIEW), schema: { params: UuidParamsSchema } }, async (req, reply) => {
    try { return { data: await service.getRouteListById(req.params.id, (req.user as AuthClaims).tenant_id) }; } catch (err) { return replyError(err, reply); }
  });

  app.patch('/:id', {
    preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_UPDATE),
    schema: { params: UuidParamsSchema, body: z.object({ name: z.string().optional(), description: z.string().nullable().optional(), status: z.enum(['active','inactive']).optional() }) },
  }, async (req, reply) => {
    try { return { data: await service.updateRouteList(req.params.id, (req.user as AuthClaims).tenant_id, req.body) }; } catch (err) { return replyError(err, reply); }
  });

  app.delete('/:id', { preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_UPDATE), schema: { params: UuidParamsSchema } }, async (req, reply) => {
    try { await service.deleteRouteList(req.params.id, (req.user as AuthClaims).tenant_id); return reply.code(204).send(); } catch (err) { return replyError(err, reply); }
  });

  app.post('/:id/entries', {
    preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_UPDATE),
    schema: { params: UuidParamsSchema, body: z.object({ entry_type: EntryTypeSchema, entry_id: z.string().uuid(), priority: z.number().int().min(1).max(9999).optional() }) },
  }, async (req, reply) => {
    try { return reply.code(201).send({ data: await service.addRouteListEntry(req.params.id, (req.user as AuthClaims).tenant_id, req.body) }); } catch (err) { return replyError(err, reply); }
  });

  app.delete('/:id/entries/:entryId', { preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_UPDATE), schema: { params: idEntryParams } }, async (req, reply) => {
    try { await service.removeRouteListEntry(req.params.entryId, req.params.id, (req.user as AuthClaims).tenant_id); return reply.code(204).send(); } catch (err) { return replyError(err, reply); }
  });
};

export const carrierResolutionController: FastifyPluginAsyncZod = async (app) => {
  // Site-aware carrier resolution (#307)
  app.post('/resolve', {
    preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_VIEW),
    schema: { body: z.object({ dial_string: z.string().min(1).max(50), site_id: z.string().uuid().nullable().optional() }) },
  }, async (req) => {
    const user = req.user as AuthClaims;
    return { data: await service.resolveCarrierForSite(user.tenant_id, req.body.dial_string, req.body.site_id) };
  });
};
