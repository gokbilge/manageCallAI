import { z } from 'zod';
import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { SkillsRepository } from './skills.repository.js';
import {
  AgentSkillNotFoundError,
  SkillNotFoundError,
  SkillRequirementNotFoundError,
  SkillValidationError,
  SkillsService,
} from './skills.service.js';
import { sendNotFound, sendInvalidArgument } from '../../errors/index.js';
import {
  UuidParamsSchema,
  CreateSkillBodySchema,
  UpdateSkillBodySchema,
  AssignAgentSkillBodySchema,
  AddQueueSkillRequirementBodySchema,
} from '@managecallai/contracts';

const service = new SkillsService(new SkillsRepository(db));

function replyError(err: unknown, reply: FastifyReply): void {
  if (
    err instanceof SkillNotFoundError ||
    err instanceof SkillRequirementNotFoundError ||
    err instanceof AgentSkillNotFoundError
  ) {
    return sendNotFound(reply, err.message);
  }
  if (err instanceof SkillValidationError) {
    return sendInvalidArgument(reply, err.message);
  }
  throw err;
}

export const skillController: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/',
    { preHandler: requireCapability(CAPABILITIES.TENANT_SKILLS_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listByTenant(user.tenant_id) };
    },
  );

  app.post(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_SKILLS_MANAGE),
      schema: { body: CreateSkillBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const skill = await service.create({ ...req.body, tenant_id: user.tenant_id });
        return reply.code(201).send({ data: skill });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.get(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_SKILLS_VIEW),
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
      preHandler: requireCapability(CAPABILITIES.TENANT_SKILLS_MANAGE),
      schema: { params: UuidParamsSchema, body: UpdateSkillBodySchema },
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
};

export const agentProfileSkillController: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/:id/skills',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_AGENT_PROFILES_VIEW),
      schema: { params: UuidParamsSchema },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listAgentSkills(req.params.id, user.tenant_id) };
    },
  );

  app.post(
    '/:id/skills',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_AGENT_PROFILES_MANAGE),
      schema: { params: UuidParamsSchema, body: AssignAgentSkillBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const assigned = await service.assignSkill(req.params.id, user.tenant_id, req.body);
        return reply.code(201).send({ data: assigned });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.delete(
    '/:id/skills/:skillId',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_AGENT_PROFILES_MANAGE),
      schema: {
        params: z.object({ id: z.string().uuid(), skillId: z.string().uuid() }),
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        await service.removeSkill(req.params.id, req.params.skillId, user.tenant_id);
        return reply.code(204).send();
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );
};

export const queueSkillController: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/:id/skill-requirements',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_QUEUES_VIEW),
      schema: { params: UuidParamsSchema },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listQueueRequirements(req.params.id, user.tenant_id) };
    },
  );

  app.post(
    '/:id/skill-requirements',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_QUEUES_UPDATE),
      schema: { params: UuidParamsSchema, body: AddQueueSkillRequirementBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const req_ = await service.addQueueRequirement(req.params.id, user.tenant_id, req.body);
        return reply.code(201).send({ data: req_ });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.delete(
    '/:id/skill-requirements/:reqId',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_QUEUES_UPDATE),
      schema: {
        params: z.object({ id: z.string().uuid(), reqId: z.string().uuid() }),
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        await service.removeQueueRequirement(req.params.id, req.params.reqId, user.tenant_id);
        return reply.code(204).send();
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.post(
    '/:id/routing-evaluation/:agentProfileId',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_ROUTING_EVALUATE),
      schema: {
        params: z.object({ id: z.string().uuid(), agentProfileId: z.string().uuid() }),
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const result = await service.evaluateRouting(req.params.id, req.params.agentProfileId, user.tenant_id);
        return reply.code(201).send({ data: result });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.get(
    '/:id/routing-log',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_ROUTING_EVALUATE),
      schema: { params: UuidParamsSchema },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listRoutingLog(req.params.id, user.tenant_id) };
    },
  );
};
