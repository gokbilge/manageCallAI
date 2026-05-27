import { db } from '../../db/client.js';
import { AutomationRepository } from './automation.repository.js';
import { AutomationService } from './automation.service.js';
import type { WebhookEvent } from './automation.types.js';

const service = new AutomationService(new AutomationRepository(db));

export function fireWebhooks(tenantId: string, event: WebhookEvent, data: Record<string, unknown>): void {
  service.fireWebhooks(tenantId, event, data);
}
