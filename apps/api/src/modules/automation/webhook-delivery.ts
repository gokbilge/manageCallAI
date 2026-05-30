import { db } from '../../db/client.js';
import { AutomationRepository } from './automation.repository.js';
import { AutomationService } from './automation.service.js';
import type { WebhookEvent } from './automation.types.js';

const service = new AutomationService(new AutomationRepository(db));

export function fireWebhooks(tenantId: string, event: WebhookEvent, data: Record<string, unknown>): void {
  service.enqueueWebhooks(tenantId, event, data).catch((err: unknown) => {
    // Enqueue failures must not break the primary request, but must be visible.
    console.error('[webhooks] failed to enqueue event', { event, tenantId, err });
  });
}

export function startWebhookDeliveryWorker(intervalMs = 1000): { stop: () => void } {
  const timer = setInterval(() => {
    void service.processDueWebhookDeliveries().catch((err: unknown) => {
      console.error('[webhooks] delivery worker error', { err });
    });
  }, intervalMs);
  timer.unref();
  void service.processDueWebhookDeliveries().catch((err: unknown) => {
    console.error('[webhooks] delivery worker error on startup', { err });
  });
  return {
    stop: () => clearInterval(timer),
  };
}
