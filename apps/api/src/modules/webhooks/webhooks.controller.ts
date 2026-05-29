import type { FastifyInstance, FastifyReply } from 'fastify';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { AutomationRepository } from '../automation/automation.repository.js';
import { AutomationService, WebhookNotFoundError } from '../automation/automation.service.js';
import { WEBHOOK_EVENTS } from '../automation/automation.types.js';
import { sendNotFound } from '../../errors/index.js';

const service = new AutomationService(new AutomationRepository(db));

export async function webhooksController(app: FastifyInstance): Promise<void> {
  app.post<{ Body: { name: string; url: string; events: string[] } }>(
    '/',
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
    '/',
    { preHandler: requireCapability(CAPABILITIES.TENANT_AUTOMATION_WEBHOOKS_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listWebhooks(user.tenant_id) };
    },
  );

  app.get<{ Params: { id: string } }>(
    '/:id/deliveries',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_AUTOMATION_WEBHOOKS_VIEW),
      schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
    },
    async (req, reply: FastifyReply) => {
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

  app.get<{ Params: { id: string } }>(
    '/:id/delivery-queue',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_AUTOMATION_WEBHOOKS_VIEW),
      schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
    },
    async (req, reply: FastifyReply) => {
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

  app.delete<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_AUTOMATION_WEBHOOKS_MANAGE),
      schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
    },
    async (req, reply: FastifyReply) => {
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
}
