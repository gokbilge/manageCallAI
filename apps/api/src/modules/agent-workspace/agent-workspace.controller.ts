import { z } from 'zod';
import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { AgentWorkspaceRepository } from './agent-workspace.repository.js';
import {
  AgentAvailabilityTransitionError,
  AgentNotFoundError,
  AgentValidationError,
  AgentWorkspaceService,
} from './agent-workspace.service.js';
import { sendNotFound, sendInvalidArgument } from '../../errors/index.js';
import {
  UuidParamsSchema,
  CreateAgentProfileBodySchema,
  UpdateAgentProfileBodySchema,
  SetAgentAvailabilityBodySchema,
} from '@managecallai/contracts';

const service = new AgentWorkspaceService(new AgentWorkspaceRepository(db));

function replyError(err: unknown, reply: FastifyReply): void {
  if (err instanceof AgentNotFoundError) return sendNotFound(reply, err.message);
  if (err instanceof AgentValidationError || err instanceof AgentAvailabilityTransitionError) {
    return sendInvalidArgument(reply, err.message);
  }
  throw err;
}

export const agentProfileController: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/',
    { preHandler: requireCapability(CAPABILITIES.TENANT_AGENT_PROFILES_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listByTenant(user.tenant_id) };
    },
  );

  app.post(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_AGENT_PROFILES_MANAGE),
      schema: { body: CreateAgentProfileBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const agent = await service.create({ ...req.body, tenant_id: user.tenant_id });
        return reply.code(201).send({ data: agent });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.get(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_AGENT_PROFILES_VIEW),
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
      preHandler: requireCapability(CAPABILITIES.TENANT_AGENT_PROFILES_MANAGE),
      schema: { params: UuidParamsSchema, body: UpdateAgentProfileBodySchema },
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
      preHandler: requireCapability(CAPABILITIES.TENANT_AGENT_PROFILES_MANAGE),
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

  app.get(
    '/:id/availability',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_AGENT_AVAILABILITY_VIEW),
      schema: { params: UuidParamsSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const agent = await service.getById(req.params.id, user.tenant_id);
        return { data: agent.availability };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.patch(
    '/:id/availability',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_AGENT_PROFILES_MANAGE),
      schema: { params: UuidParamsSchema, body: SetAgentAvailabilityBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.setAvailability(req.params.id, user.tenant_id, req.body) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );
};

// Agent self-service workspace: an agent managing their own availability.
export const agentWorkspaceMeController: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/',
    { preHandler: requireCapability(CAPABILITIES.TENANT_AGENT_WORKSPACE_VIEW) },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.getWorkspaceForUser(user.sub, user.tenant_id) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.patch(
    '/availability',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_AGENT_AVAILABILITY_SET),
      schema: { body: SetAgentAvailabilityBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.setAvailabilityForUser(user.sub, user.tenant_id, req.body) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );
};

// Queue-level: list available agents for a queue (operator/admin view).
export const queueAgentAvailabilityController: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/:id/available-agents',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_AGENT_AVAILABILITY_VIEW),
      schema: {
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listAvailableForQueue(req.params.id, user.tenant_id) };
    },
  );
};
