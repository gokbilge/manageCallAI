import Fastify from 'fastify';
import { webhookController } from './modules/webhooks/webhook.controller.js';
import { ivrFlowWebhookController } from './modules/webhooks/ivr-flow-webhooks.js';

export function buildApp() {
  const app = Fastify({ logger: true });

  app.get('/health', async () => ({ status: 'ok' }));
  app.register(webhookController);
  app.register(ivrFlowWebhookController);

  return app;
}
