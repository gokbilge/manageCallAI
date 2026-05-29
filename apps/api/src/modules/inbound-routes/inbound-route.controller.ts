import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  UuidParamsSchema,
  CreateInboundRouteBodySchema,
  UpdateInboundRouteBodySchema,
} from '@managecallai/contracts';
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
import { sendNotFound, sendInvalidArgument, sendFailedPrecondition } from '../../errors/index.js';

const service = new InboundRouteService(new InboundRouteRepository(db));

function replyError(err: unknown, reply: FastifyReply): void {
  if (err instanceof InboundRouteNotFoundError || err instanceof RouteVersionNotFoundError) {
    return sendNotFound(reply, err.message);
  }
  if (err instanceof InboundRouteInputError) {
    return sendInvalidArgument(reply, err.message);
  }
  if (err instanceof RouteVersionStateError || err instanceof RollbackNotAvailableError) {
    return sendFailedPrecondition(reply, err.message);
  }
  throw err;
}

const idVidParams = z.object({ id: z.string().uuid(), vid: z.string().uuid() });

export const inboundRouteController: FastifyPluginAsyncZod = async (app) => {
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
  app.post(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_CREATE),
      schema: {
        body: CreateInboundRouteBodySchema,
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
  app.get(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_VIEW),
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

  // Update route metadata
  app.patch(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_UPDATE),
      schema: {
        params: UuidParamsSchema,
        body: UpdateInboundRouteBodySchema,
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
  app.post(
    '/:id/activate',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_ACTIVATE),
      schema: { params: UuidParamsSchema },
    },
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
  app.post(
    '/:id/deactivate',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_DEACTIVATE),
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

  // Create new draft version
  app.post(
    '/:id/versions',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_UPDATE),
      schema: {
        params: UuidParamsSchema,
        body: z.object({
          definition: z.record(z.unknown()),
        }),
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
  app.post(
    '/:id/versions/:vid/validate',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_UPDATE),
      schema: {
        params: idVidParams,
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
  app.post(
    '/:id/versions/:vid/publish',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_ACTIVATE),
      schema: {
        params: idVidParams,
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
  app.post(
    '/:id/rollback',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_INBOUND_ROUTES_ACTIVATE),
      schema: { params: UuidParamsSchema },
    },
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
};
