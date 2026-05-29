import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
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
import { sendNotFound, sendInvalidArgument } from '../../errors/index.js';
import {
  UuidParamsSchema,
  CreateOutboundRouteBodySchema,
  UpdateOutboundRouteBodySchema,
  ResolveOutboundRouteBodySchema,
} from '@managecallai/contracts';

const service = new OutboundRouteService(new OutboundRouteRepository(db));

function replyError(err: unknown, reply: FastifyReply): void {
  if (err instanceof OutboundRouteNotFoundError) return sendNotFound(reply, err.message);
  if (err instanceof OutboundRouteValidationError) return sendInvalidArgument(reply, err.message);
  throw err;
}

export const outboundRouteController: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/',
    { preHandler: requireCapability(CAPABILITIES.TENANT_OUTBOUND_ROUTES_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listByTenant(user.tenant_id) };
    },
  );

  app.post(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_OUTBOUND_ROUTES_CREATE),
      schema: {
        body: CreateOutboundRouteBodySchema,
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

  app.get(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_OUTBOUND_ROUTES_VIEW),
      schema: { params: UuidParamsSchema },
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

  app.patch(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_OUTBOUND_ROUTES_UPDATE),
      schema: {
        params: UuidParamsSchema,
        body: UpdateOutboundRouteBodySchema,
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

  app.post(
    '/:id/deactivate',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_OUTBOUND_ROUTES_UPDATE),
      schema: { params: UuidParamsSchema },
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
  app.post(
    '/resolve',
    {
      preHandler: authenticateRuntime,
      schema: {
        body: ResolveOutboundRouteBodySchema,
      },
    },
    async (req, reply) => {
      const resolved = await service.resolveRouteForNumber(req.body.tenant_id, req.body.dial_number);
      if (!resolved) return sendNotFound(reply, 'No active outbound route matches the dial number');
      return { data: resolved };
    },
  );
};
