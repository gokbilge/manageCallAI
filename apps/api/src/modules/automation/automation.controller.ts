import type { FastifyInstance, FastifyReply } from 'fastify';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { AutomationRepository } from './automation.repository.js';
import { ApiKeyNotFoundError, AutomationService, WebhookNotFoundError } from './automation.service.js';
import { WEBHOOK_EVENTS } from './automation.types.js';

const service = new AutomationService(new AutomationRepository(db));

function replyError(err: unknown, reply: FastifyReply): FastifyReply {
  if (err instanceof ApiKeyNotFoundError || err instanceof WebhookNotFoundError) {
    return reply.code(404).send({ error: err.message });
  }
  throw err;
}

export async function automationController(app: FastifyInstance): Promise<void> {
  // --- API Keys ---

  app.post<{ Body: { name: string } }>(
    '/keys',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_AUTOMATION_KEYS_MANAGE),
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          additionalProperties: false,
          properties: { name: { type: 'string', minLength: 1, maxLength: 255 } },
        },
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

  app.delete<{ Params: { id: string } }>(
    '/keys/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_AUTOMATION_KEYS_MANAGE),
      schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
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

  app.post<{ Body: { name: string; url: string; events: string[] } }>(
    '/webhooks',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_AUTOMATION_WEBHOOKS_MANAGE),
      schema: {
        body: {
          type: 'object',
          required: ['name', 'url', 'events'],
          additionalProperties: false,
          properties: {
            name:   { type: 'string', minLength: 1, maxLength: 255 },
            url:    { type: 'string', minLength: 1, maxLength: 2048 },
            events: { type: 'array', minItems: 1, items: { type: 'string', enum: [...WEBHOOK_EVENTS] } },
          },
        },
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

  app.delete<{ Params: { id: string } }>(
    '/webhooks/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_AUTOMATION_WEBHOOKS_MANAGE),
      schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
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
}
