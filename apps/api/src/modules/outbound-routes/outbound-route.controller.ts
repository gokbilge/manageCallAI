import type { FastifyInstance, FastifyReply } from 'fastify';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { authenticateRuntime } from '../runtime/runtime-auth.js';
import { OutboundRouteRepository } from './outbound-route.repository.js';
import {
  OutboundRouteNotFoundError,
  OutboundRouteService,
  OutboundRouteValidationError,
} from './outbound-route.service.js';
import type { CreateOutboundRouteInput, UpdateOutboundRouteInput } from './outbound-route.types.js';
import { sendNotFound, sendInvalidArgument } from '../../errors/index.js';

const service = new OutboundRouteService(new OutboundRouteRepository(db));

function replyError(err: unknown, reply: FastifyReply): void {
  if (err instanceof OutboundRouteNotFoundError) return sendNotFound(reply, err.message);
  if (err instanceof OutboundRouteValidationError) return sendInvalidArgument(reply, err.message);
  throw err;
}

export async function outboundRouteController(app: FastifyInstance): Promise<void> {
  app.get(
    '/',
    { preHandler: requireCapability(CAPABILITIES.TENANT_OUTBOUND_ROUTES_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listByTenant(user.tenant_id) };
    },
  );

  app.post<{ Body: Omit<CreateOutboundRouteInput, 'tenant_id'> }>(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_OUTBOUND_ROUTES_CREATE),
      schema: {
        body: {
          type: 'object',
          required: ['name', 'match_prefix', 'sip_trunk_id'],
          additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            match_prefix: { type: 'string', minLength: 1, maxLength: 30 },
            priority: { type: 'integer', minimum: 1, maximum: 9999 },
            sip_trunk_id: { type: 'string', format: 'uuid' },
            fallback_sip_trunk_id: { anyOf: [{ type: 'string', format: 'uuid' }, { type: 'null' }] },
            max_calls_per_minute: { anyOf: [{ type: 'integer', minimum: 1, maximum: 10000 }, { type: 'null' }] },
            allowed_caller_id_numbers_json: { anyOf: [{ type: 'array', items: { type: 'string' } }, { type: 'null' }] },
          },
        },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const route = await service.create({ ...req.body, tenant_id: user.tenant_id });
        return reply.code(201).send({ data: route });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_OUTBOUND_ROUTES_VIEW),
      schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.getById(req.params.id, user.tenant_id) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateOutboundRouteInput }>(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_OUTBOUND_ROUTES_UPDATE),
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            match_prefix: { type: 'string', minLength: 1, maxLength: 30 },
            priority: { type: 'integer', minimum: 1, maximum: 9999 },
            sip_trunk_id: { type: 'string', format: 'uuid' },
            fallback_sip_trunk_id: { anyOf: [{ type: 'string', format: 'uuid' }, { type: 'null' }] },
            max_calls_per_minute: { anyOf: [{ type: 'integer', minimum: 1, maximum: 10000 }, { type: 'null' }] },
            allowed_caller_id_numbers_json: { anyOf: [{ type: 'array', items: { type: 'string' } }, { type: 'null' }] },
            status: { type: 'string', enum: ['active', 'inactive'] },
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

  app.post<{ Params: { id: string } }>(
    '/:id/deactivate',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_OUTBOUND_ROUTES_UPDATE),
      schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.deactivate(req.params.id, user.tenant_id) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  // Internal resolution endpoint — runtime token auth only, not exposed publicly as a user-facing API.
  // FreeSWITCH ESL agent calls this to select a trunk for an outbound dial.
  app.post<{ Body: { tenant_id: string; dial_number: string } }>(
    '/resolve',
    {
      preHandler: authenticateRuntime,
      schema: {
        body: {
          type: 'object',
          required: ['tenant_id', 'dial_number'],
          additionalProperties: false,
          properties: {
            tenant_id: { type: 'string', format: 'uuid' },
            dial_number: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (req, reply) => {
      const resolved = await service.resolveRouteForNumber(req.body.tenant_id, req.body.dial_number);
      if (!resolved) return sendNotFound(reply, 'No active outbound route matches the dial number');
      return { data: resolved };
    },
  );
}
