import Fastify from 'fastify';
import { webhookController } from './modules/webhooks/webhook.controller.js';

export function buildApp() {
  const app = Fastify({ logger: true });

  app.get('/health', async () => ({ status: 'ok' }));
  app.register(webhookController);

  return app;
}
