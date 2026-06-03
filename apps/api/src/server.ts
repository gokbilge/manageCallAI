import { buildApp, runBootstrapIfNeeded } from './app.js';
import { config } from './config/env.js';
import { startWebhookDeliveryWorker } from './modules/automation/webhook-delivery.js';

const app = buildApp();
await runBootstrapIfNeeded(app);
const webhookWorker = startWebhookDeliveryWorker(config.webhookWorkerIntervalMs);

app.listen({ port: config.port, host: '0.0.0.0' }, (err) => {
  if (err) {
    webhookWorker.stop();
    app.log.error(err);
    process.exit(1);
  }
});
