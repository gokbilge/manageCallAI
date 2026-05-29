import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { UuidParamsSchema, CreateAutomationWebhookBodySchema } from '@managecallai/contracts';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { AutomationRepository } from '../automation/automation.repository.js';
import { AutomationService, WebhookNotFoundError } from '../automation/automation.service.js';
import { sendNotFound } from '../../errors/index.js';

const service = new AutomationService(new AutomationRepository(db));

export const webhooksController: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_AUTOMATION_WEBHOOKS_MANAGE),
      schema: {
        body: CreateAutomationWebhookBodySchema,
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      const webhook = await service.createWebhook(
        user.tenant_id,
        req.body.name,
        req.body.url,
        req.body.events as never,
        user.sub,
      );
      return reply.code(201).send({ data: webhook });
    },
  );

  app.get(
    '/',
    { preHandler: requireCapability(CAPABILITIES.TENANT_AUTOMATION_WEBHOOKS_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listWebhooks(user.tenant_id) };
    },
  );

  app.get(
    '/:id/deliveries',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_AUTOMATION_WEBHOOKS_VIEW),
      schema: { params: UuidParamsSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.getDeliveryHistory(req.params.id, user.tenant_id) };
      } catch (err) {
        if (err instanceof WebhookNotFoundError) {
          return sendNotFound(reply, (err as Error).message);
        }
        throw err;
      }
    },
  );

  app.get(
    '/:id/delivery-queue',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_AUTOMATION_WEBHOOKS_VIEW),
      schema: { params: UuidParamsSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.getDeliveryQueue(req.params.id, user.tenant_id) };
      } catch (err) {
        if (err instanceof WebhookNotFoundError) {
          return sendNotFound(reply, (err as Error).message);
        }
        throw err;
      }
    },
  );

  app.delete(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_AUTOMATION_WEBHOOKS_MANAGE),
      schema: { params: UuidParamsSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        await service.revokeWebhook(req.params.id, user.tenant_id);
        return reply.code(204).send();
      } catch (err) {
        if (err instanceof WebhookNotFoundError) {
          return sendNotFound(reply, (err as Error).message);
        }
        throw err;
      }
    },
  );
};
