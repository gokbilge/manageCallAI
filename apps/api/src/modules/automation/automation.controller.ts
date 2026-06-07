import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { UuidParamsSchema, CreateApiKeyBodySchema, CreateAutomationWebhookBodySchema } from '@managecallai/contracts';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { AutomationRepository } from './automation.repository.js';
import { ApiKeyNotFoundError, AutomationService, WebhookNotFoundError } from './automation.service.js';
import { sendNotFound, sendEntitlementLimitExceeded } from '../../errors/index.js';
import { entitlementSvc, EntitlementLimitExceededError } from '../entitlement/index.js';

const service = new AutomationService(new AutomationRepository(db));

function replyError(err: unknown, reply: FastifyReply): void {
  if (err instanceof ApiKeyNotFoundError || err instanceof WebhookNotFoundError) {
    return sendNotFound(reply, err.message);
  }
  throw err;
}

export const automationController: FastifyPluginAsyncZod = async (app) => {
  // --- API Keys ---

  app.post(
    '/keys',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_AUTOMATION_KEYS_MANAGE),
      schema: {
        body: CreateApiKeyBodySchema,
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        await entitlementSvc.assertWithinLimit(user.tenant_id, 'api_key.max_count');
      } catch (err) {
        if (err instanceof EntitlementLimitExceededError) return sendEntitlementLimitExceeded(reply, err);
        throw err;
      }
      const key = await service.createApiKey(
        user.tenant_id,
        req.body.name,
        req.body.capabilities,
        user.sub,
      );
      return reply.code(201).send({ data: key });
    },
  );

  app.get(
    '/keys',
    { preHandler: requireCapability(CAPABILITIES.TENANT_AUTOMATION_KEYS_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listApiKeys(user.tenant_id) };
    },
  );

  app.delete(
    '/keys/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_AUTOMATION_KEYS_MANAGE),
      schema: { params: UuidParamsSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        await service.revokeApiKey(req.params.id, user.tenant_id);
        return reply.code(204).send();
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  // --- Webhooks ---

  app.post(
    '/webhooks',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_AUTOMATION_WEBHOOKS_MANAGE),
      schema: {
        body: CreateAutomationWebhookBodySchema,
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        await entitlementSvc.assertWithinLimit(user.tenant_id, 'webhook.max_count');
      } catch (err) {
        if (err instanceof EntitlementLimitExceededError) return sendEntitlementLimitExceeded(reply, err);
        throw err;
      }
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
    '/webhooks',
    { preHandler: requireCapability(CAPABILITIES.TENANT_AUTOMATION_WEBHOOKS_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listWebhooks(user.tenant_id) };
    },
  );

  app.delete(
    '/webhooks/:id',
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
        return replyError(err, reply);
      }
    },
  );

  // --- Dead-letter queue (abandoned deliveries) ---

  app.get(
    '/webhook-delivery/abandoned',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_AUTOMATION_WEBHOOKS_VIEW),
      schema: {
        querystring: z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }),
      },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listAbandonedDeliveries(user.tenant_id, req.query.limit) };
    },
  );

  app.post(
    '/webhook-delivery/:id/retry',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_AUTOMATION_WEBHOOKS_MANAGE),
      schema: { params: UuidParamsSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const item = await service.retryAbandonedDelivery(req.params.id, user.tenant_id);
        return { data: item };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.post(
    '/webhook-delivery/:id/dismiss',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_AUTOMATION_WEBHOOKS_MANAGE),
      schema: {
        params: UuidParamsSchema,
        body: z.object({ reason: z.string().max(500).optional() }),
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        await service.dismissAbandonedDelivery(req.params.id, user.tenant_id, req.body.reason);
        return reply.code(204).send();
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );
};
