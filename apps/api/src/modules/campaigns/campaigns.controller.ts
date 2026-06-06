import { z } from 'zod';
import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { CampaignsRepository } from './campaigns.repository.js';
import {
  CampaignAgentNotFoundError,
  CampaignContactNotFoundError,
  CampaignNotFoundError,
  CampaignValidationError,
  CampaignsService,
} from './campaigns.service.js';
import { sendNotFound, sendInvalidArgument } from '../../errors/index.js';
import {
  UuidParamsSchema,
  CreateCampaignBodySchema,
  UpdateCampaignBodySchema,
  AddCampaignContactBodySchema,
  AssignCampaignAgentBodySchema,
  CampaignStatusSchema,
} from '@managecallai/contracts';

const service = new CampaignsService(new CampaignsRepository(db));

function replyError(err: unknown, reply: FastifyReply): void {
  if (
    err instanceof CampaignNotFoundError ||
    err instanceof CampaignContactNotFoundError ||
    err instanceof CampaignAgentNotFoundError
  ) {
    return sendNotFound(reply, err.message);
  }
  if (err instanceof CampaignValidationError) {
    return sendInvalidArgument(reply, err.message);
  }
  throw err;
}

export const campaignController: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/',
    { preHandler: requireCapability(CAPABILITIES.TENANT_CAMPAIGNS_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listByTenant(user.tenant_id) };
    },
  );

  app.post(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CAMPAIGNS_MANAGE),
      schema: { body: CreateCampaignBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const campaign = await service.create({ ...req.body, tenant_id: user.tenant_id });
        return reply.code(201).send({ data: campaign });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.get(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CAMPAIGNS_VIEW),
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
      preHandler: requireCapability(CAPABILITIES.TENANT_CAMPAIGNS_MANAGE),
      schema: { params: UuidParamsSchema, body: UpdateCampaignBodySchema },
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
    '/:id/transition',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CAMPAIGNS_MANAGE),
      schema: {
        params: UuidParamsSchema,
        body: z.object({ status: CampaignStatusSchema }),
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.transition(req.params.id, user.tenant_id, req.body.status) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  // ── Contacts ──────────────────────────────────────────────────────────────

  app.get(
    '/:id/contacts',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CAMPAIGNS_VIEW),
      schema: { params: UuidParamsSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.listContacts(req.params.id, user.tenant_id) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.post(
    '/:id/contacts',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CAMPAIGNS_CONTACTS_MANAGE),
      schema: { params: UuidParamsSchema, body: AddCampaignContactBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const contact = await service.addContact(req.params.id, user.tenant_id, req.body);
        return reply.code(201).send({ data: contact });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.delete(
    '/:id/contacts/:contactId',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CAMPAIGNS_CONTACTS_MANAGE),
      schema: {
        params: z.object({ id: z.string().uuid(), contactId: z.string().uuid() }),
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        await service.removeContact(req.params.id, req.params.contactId, user.tenant_id);
        return reply.code(204).send();
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  // ── Agent assignments ─────────────────────────────────────────────────────

  app.get(
    '/:id/agents',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CAMPAIGNS_VIEW),
      schema: { params: UuidParamsSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.listAssignments(req.params.id, user.tenant_id) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.post(
    '/:id/agents',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CAMPAIGNS_MANAGE),
      schema: { params: UuidParamsSchema, body: AssignCampaignAgentBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const assignment = await service.assignAgent(req.params.id, user.tenant_id, req.body);
        return reply.code(201).send({ data: assignment });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.delete(
    '/:id/agents/:agentProfileId',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CAMPAIGNS_MANAGE),
      schema: {
        params: z.object({ id: z.string().uuid(), agentProfileId: z.string().uuid() }),
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        await service.removeAgent(req.params.id, req.params.agentProfileId, user.tenant_id);
        return reply.code(204).send();
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );
};
