import type { AuthClaims } from '../auth/auth-claims.js';
import { AutomationRepository } from './automation.repository.js';
import type { ApiKey, ApiKeyCreated, AutomationWebhook, AutomationWebhookCreated, WebhookEvent } from './automation.types.js';

export class ApiKeyNotFoundError extends Error {
  constructor() { super('API key not found or already revoked'); this.name = 'ApiKeyNotFoundError'; }
}

export class WebhookNotFoundError extends Error {
  constructor() { super('Webhook not found or already revoked'); this.name = 'WebhookNotFoundError'; }
}

export class AutomationService {
  constructor(private readonly repo: AutomationRepository) {}

  async createApiKey(tenantId: string, name: string, createdBy?: string): Promise<ApiKeyCreated> {
    const { rawKey, keyHash, keyPrefix } = AutomationRepository.generateApiKey();
    const record = await this.repo.createApiKey({
      tenant_id: tenantId,
      name,
      key_prefix: keyPrefix,
      key_hash: keyHash,
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
    return { sub: record.id, tenant_id: record.tenant_id, email: '', role: 'tenant_admin' };
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

  fireWebhooks(tenantId: string, event: WebhookEvent, data: Record<string, unknown>): void {
    void this._deliver(tenantId, event, data);
  }

  private async _deliver(tenantId: string, event: WebhookEvent, data: Record<string, unknown>): Promise<void> {
    let targets: Array<{ id: string; url: string; signing_secret: string }>;
    try {
      targets = await this.repo.findActiveWebhooksForEvent(tenantId, event);
    } catch {
      return;
    }
    const payload = JSON.stringify({ event, tenant_id: tenantId, data, timestamp: new Date().toISOString() });
    for (const target of targets) {
      const sig = AutomationRepository.signPayload(target.signing_secret, payload);
      fetch(target.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ManageCall-Signature': `sha256=${sig}`,
          'X-ManageCall-Event': event,
        },
        body: payload,
        signal: AbortSignal.timeout(10_000),
      }).then(async (res) => {
        if (res.ok) {
          await this.repo.resetDeliveryFailure(target.id).catch(() => {});
        } else {
          await this.repo.recordDeliveryFailure(target.id).catch(() => {});
        }
      }).catch(async () => {
        await this.repo.recordDeliveryFailure(target.id).catch(() => {});
      });
    }
  }
}
