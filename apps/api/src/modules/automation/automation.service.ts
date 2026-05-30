import type { AuthClaims } from '../auth/auth-claims.js';
import { AutomationRepository } from './automation.repository.js';
import type {
  ApiKey,
  ApiKeyCreated,
  AutomationWebhook,
  AutomationWebhookCreated,
  WebhookDeliveryAttempt,
  WebhookDeliveryQueueItem,
  WebhookEvent,
} from './automation.types.js';

export class ApiKeyNotFoundError extends Error {
  constructor() { super('API key not found or already revoked'); this.name = 'ApiKeyNotFoundError'; }
}

export class WebhookNotFoundError extends Error {
  constructor() { super('Webhook not found or already revoked'); this.name = 'WebhookNotFoundError'; }
}

export class AutomationService {
  constructor(private readonly repo: AutomationRepository) {}

  async createApiKey(
    tenantId: string,
    name: string,
    capabilities?: string[],
    createdBy?: string,
  ): Promise<ApiKeyCreated> {
    const { rawKey, keyHash, keyPrefix } = AutomationRepository.generateApiKey();
    const record = await this.repo.createApiKey({
      tenant_id: tenantId,
      name,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      capabilities,
      created_by: createdBy,
    });
    return { ...record, key: rawKey };
  }

  listApiKeys(tenantId: string): Promise<ApiKey[]> {
    return this.repo.listApiKeys(tenantId);
  }

  async revokeApiKey(id: string, tenantId: string): Promise<void> {
    const ok = await this.repo.revokeApiKey(id, tenantId);
    if (!ok) throw new ApiKeyNotFoundError();
  }

  async resolveApiKey(rawKey: string): Promise<AuthClaims | null> {
    const keyHash = AutomationRepository.hashKey(rawKey);
    const record = await this.repo.findApiKeyByHash(keyHash);
    if (!record) return null;
    return {
      sub: record.id,
      tenant_id: record.tenant_id,
      email: '',
      capabilities: record.capabilities,
    };
  }

  async createWebhook(
    tenantId: string,
    name: string,
    url: string,
    events: WebhookEvent[],
    createdBy?: string,
  ): Promise<AutomationWebhookCreated> {
    const signing_secret = AutomationRepository.generateWebhookSecret();
    const record = await this.repo.createWebhook({
      tenant_id: tenantId,
      name,
      url,
      events: [...events],
      signing_secret,
      created_by: createdBy,
    });
    return { ...record, signing_secret };
  }

  listWebhooks(tenantId: string): Promise<AutomationWebhook[]> {
    return this.repo.listWebhooks(tenantId);
  }

  async revokeWebhook(id: string, tenantId: string): Promise<void> {
    const ok = await this.repo.revokeWebhook(id, tenantId);
    if (!ok) throw new WebhookNotFoundError();
  }

  async getDeliveryHistory(webhookId: string, tenantId: string): Promise<WebhookDeliveryAttempt[]> {
    const webhook = await this.repo.findWebhookById(webhookId, tenantId);
    if (!webhook) throw new WebhookNotFoundError();
    return this.repo.findDeliveryLog(webhookId);
  }

  async getDeliveryQueue(webhookId: string, tenantId: string): Promise<WebhookDeliveryQueueItem[]> {
    const webhook = await this.repo.findWebhookById(webhookId, tenantId);
    if (!webhook) throw new WebhookNotFoundError();
    return this.repo.findDeliveryQueueForWebhook(webhookId, tenantId);
  }

  async enqueueWebhooks(tenantId: string, event: WebhookEvent, data: Record<string, unknown>): Promise<WebhookDeliveryQueueItem[]> {
    const payload = { event, tenant_id: tenantId, data, timestamp: new Date().toISOString() };
    return this.repo.enqueueWebhookDeliveries({ tenant_id: tenantId, event, payload_json: payload });
  }

  listAbandonedDeliveries(tenantId: string, limit?: number): Promise<WebhookDeliveryQueueItem[]> {
    return this.repo.listAbandonedDeliveries(tenantId, limit);
  }

  async retryAbandonedDelivery(id: string, tenantId: string): Promise<WebhookDeliveryQueueItem> {
    const item = await this.repo.retryAbandonedDelivery(id, tenantId);
    if (!item) throw new WebhookNotFoundError();
    return item;
  }

  async dismissAbandonedDelivery(id: string, tenantId: string, reason?: string): Promise<void> {
    const ok = await this.repo.dismissAbandonedDelivery(id, tenantId, reason);
    if (!ok) throw new WebhookNotFoundError();
  }

  async processDueWebhookDeliveries(limit = 25): Promise<{ claimed: number; delivered: number; failed: number }> {
    const deliveries = await this.repo.claimDueWebhookDeliveries(limit);
    let delivered = 0;
    let failed = 0;

    for (const delivery of deliveries) {
      const ok = await this.deliverClaimedWebhook(delivery);
      if (ok) delivered += 1;
      else failed += 1;
    }

    return { claimed: deliveries.length, delivered, failed };
  }

  private async deliverClaimedWebhook(delivery: {
    id: string;
    webhook_id: string;
    tenant_id: string;
    event: string;
    payload_json: Record<string, unknown>;
    attempt_count: number;
    signing_secret: string;
    url: string;
  }): Promise<boolean> {
    const payload = JSON.stringify(delivery.payload_json);
    const sig = AutomationRepository.signPayload(delivery.signing_secret, payload);
    const start = Date.now();
    let status: 'success' | 'failed' = 'failed';
    let responseCode: number | null = null;
    let errorMessage: string | null = null;

    try {
      const eventId = (delivery as Record<string, unknown>)['event_id'] as string | undefined;
      const res = await fetch(delivery.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ManageCall-Signature': `sha256=${sig}`,
          'X-ManageCall-Event': delivery.event,
          ...(eventId ? { 'Webhook-Event-Id': eventId } : {}),
        },
        body: payload,
        signal: AbortSignal.timeout(10_000),
      });
      responseCode = res.status;
      if (res.ok) {
        status = 'success';
        await this.ignoreDeliveryError(this.repo.resetDeliveryFailure(delivery.webhook_id));
      } else {
        errorMessage = `Webhook returned HTTP ${res.status}`;
        await this.ignoreDeliveryError(this.repo.recordDeliveryFailure(delivery.webhook_id));
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Webhook delivery failed';
      await this.ignoreDeliveryError(this.repo.recordDeliveryFailure(delivery.webhook_id));
    }

    const durationMs = Date.now() - start;
    await this.ignoreDeliveryError(
      this.repo.logDeliveryAttempt({
        webhook_id: delivery.webhook_id,
        tenant_id: delivery.tenant_id,
        event: delivery.event,
        attempt_number: delivery.attempt_count,
        status,
        response_code: responseCode,
        duration_ms: durationMs,
      }),
    );

    if (status === 'success') {
      await this.ignoreDeliveryError(
        this.repo.markWebhookDeliveryDelivered({
          delivery_id: delivery.id,
          response_code: responseCode,
        }),
      );
      return true;
    }

    await this.ignoreDeliveryError(
      this.repo.markWebhookDeliveryFailed({
        delivery_id: delivery.id,
        response_code: responseCode,
        error_message: errorMessage,
        retry_delay_seconds: delivery.attempt_count <= 1 ? 2 : 10,
      }),
    );
    return false;
  }

  private async ignoreDeliveryError(action: Promise<void> | void): Promise<void> {
    try {
      await action;
    } catch {
      return;
    }
  }
}
