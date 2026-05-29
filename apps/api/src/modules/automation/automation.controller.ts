import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { UuidParamsSchema, CreateApiKeyBodySchema, CreateAutomationWebhookBodySchema } from '@managecallai/contracts';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { AutomationRepository } from './automation.repository.js';
import { ApiKeyNotFoundError, AutomationService, WebhookNotFoundError } from './automation.service.js';
import { sendNotFound } from '../../errors/index.js';

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
      const key = await service.createApiKey(user.tenant_id, req.body.name, user.sub);
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
};
