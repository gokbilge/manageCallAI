import type { FastifyInstance, FastifyReply } from 'fastify';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { InboundRouteRepository } from './inbound-route.repository.js';
import {
  InboundRouteNotFoundError,
  InboundRouteInputError,
  InboundRouteService,
  RollbackNotAvailableError,
  RouteVersionNotFoundError,
  RouteVersionStateError,
} from './inbound-route.service.js';

const service = new InboundRouteService(new InboundRouteRepository(db));

function replyError(err: unknown, reply: FastifyReply): FastifyReply {
  if (err instanceof InboundRouteNotFoundError || err instanceof RouteVersionNotFoundError) {
    return reply.code(404).send({ error: err.message });
  }
  if (err instanceof InboundRouteInputError) {
    return reply.code(422).send({ error: err.message });
  }
  if (err instanceof RouteVersionStateError || err instanceof RollbackNotAvailableError) {
    return reply.code(409).send({ error: err.message });
  }
  throw err;
}

const MATCH_TYPES = ['did', 'trunk', 'pattern'] as const;
const TARGET_TYPES = ['flow', 'extension'] as const;

const idParams = {
  schema: {
    params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
  },
} as const;

export async function inboundRouteController(app: FastifyInstance): Promise<void> {
  // List routes
  app.get(
    '/',
    { preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listByTenant(user.tenant_id) };
    },
  );

  // Create route
  app.post<{
    Body: {
      name: string;
      match_type: 'did' | 'trunk' | 'pattern';
      match_value: string;
      phone_number_id?: string;
      target_type: 'flow' | 'extension';
      target_id?: string;
    };
  }>(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_CREATE),
      schema: {
        body: {
          type: 'object',
          required: ['name', 'match_type', 'match_value', 'target_type'],
          additionalProperties: false,
          properties: {
            name:            { type: 'string', minLength: 1, maxLength: 255 },
            match_type:      { type: 'string', enum: [...MATCH_TYPES] },
            match_value:     { type: 'string', minLength: 1, maxLength: 255 },
            phone_number_id: { type: 'string', format: 'uuid' },
            target_type:     { type: 'string', enum: [...TARGET_TYPES] },
            target_id:       { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const route = await service.create({ ...req.body, tenant_id: user.tenant_id, created_by: user.sub });
        return reply.code(201).send({ data: route });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  // Get route with versions
  app.get<{ Params: { id: string } }>(
    '/:id',
    { ...idParams, preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_VIEW) },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.getById(req.params.id, user.tenant_id) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  // Update route metadata
  app.patch<{
    Params: { id: string };
    Body: {
      name?: string;
      match_type?: 'did' | 'trunk' | 'pattern';
      match_value?: string;
      phone_number_id?: string | null;
      target_type?: 'flow' | 'extension';
      target_id?: string | null;
    };
  }>(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_UPDATE),
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name:            { type: 'string', minLength: 1, maxLength: 255 },
            match_type:      { type: 'string', enum: [...MATCH_TYPES] },
            match_value:     { type: 'string', minLength: 1, maxLength: 255 },
            phone_number_id: { anyOf: [{ type: 'string', format: 'uuid' }, { type: 'null' }] },
            target_type:     { type: 'string', enum: [...TARGET_TYPES] },
            target_id:       { anyOf: [{ type: 'string', format: 'uuid' }, { type: 'null' }] },
          },
        },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.update(req.params.id, user.tenant_id, req.body) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  // Activate route (validates target, checks conflicts, sets status=active)
  app.post<{ Params: { id: string } }>(
    '/:id/activate',
    { ...idParams, preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_ACTIVATE) },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.activate(req.params.id, user.tenant_id) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  // Deactivate route
  app.post<{ Params: { id: string } }>(
    '/:id/deactivate',
    { ...idParams, preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_DEACTIVATE) },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.deactivate(req.params.id, user.tenant_id) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  // Create new draft version
  app.post<{ Params: { id: string }; Body: { definition: Record<string, unknown> } }>(
    '/:id/versions',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_UPDATE),
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          required: ['definition'],
          additionalProperties: false,
          properties: { definition: { type: 'object' } },
        },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const version = await service.createVersion(req.params.id, user.tenant_id, req.body.definition, user.sub);
        return reply.code(201).send({ data: version });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  // Validate a version
  app.post<{ Params: { id: string; vid: string } }>(
    '/:id/versions/:vid/validate',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_UPDATE),
      schema: {
        params: {
          type: 'object',
          required: ['id', 'vid'],
          properties: { id: { type: 'string' }, vid: { type: 'string' } },
        },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const result = await service.validate(req.params.id, req.params.vid, user.tenant_id);
        return reply.code(result.outcome.status === 'passed' ? 200 : 422).send({ data: result });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  // Publish a validated version
  app.post<{ Params: { id: string; vid: string } }>(
    '/:id/versions/:vid/publish',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_ACTIVATE),
      schema: {
        params: {
          type: 'object',
          required: ['id', 'vid'],
          properties: { id: { type: 'string' }, vid: { type: 'string' } },
        },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const route = await service.publish(req.params.id, req.params.vid, user.tenant_id, user.sub);
        return { data: route };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  // Rollback to previous published version
  app.post<{ Params: { id: string } }>(
    '/:id/rollback',
    { ...idParams, preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_ACTIVATE) },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const route = await service.rollback(req.params.id, user.tenant_id, user.sub);
        return { data: route };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );
}
