import { createHash, createHmac, randomBytes } from 'node:crypto';
import type { Pool } from 'pg';
import type { ApiKey, AutomationWebhook } from './automation.types.js';

export class AutomationRepository {
  constructor(private readonly db: Pool) {}

  static hashKey(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex');
  }

  static generateApiKey(): { rawKey: string; keyHash: string; keyPrefix: string } {
    const hex = randomBytes(32).toString('hex');
    const rawKey = `mcak_${hex}`;
    return { rawKey, keyHash: AutomationRepository.hashKey(rawKey), keyPrefix: hex.slice(0, 8) };
  }

  static generateWebhookSecret(): string {
    return randomBytes(32).toString('hex');
  }

  static signPayload(secret: string, payload: string): string {
    return createHmac('sha256', secret).update(payload).digest('hex');
  }

  async createApiKey(input: {
    tenant_id: string;
    name: string;
    key_prefix: string;
    key_hash: string;
    created_by?: string;
  }): Promise<ApiKey> {
    const r = await this.db.query<ApiKey>(
      `INSERT INTO automation_api_keys (tenant_id, name, key_prefix, key_hash, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, tenant_id, name, key_prefix, created_by, created_at, revoked_at`,
      [input.tenant_id, input.name, input.key_prefix, input.key_hash, input.created_by ?? null],
    );
    return r.rows[0]!;
  }

  async findApiKeyByHash(keyHash: string): Promise<{ id: string; tenant_id: string } | null> {
    const r = await this.db.query<{ id: string; tenant_id: string }>(
      `SELECT id, tenant_id FROM automation_api_keys WHERE key_hash = $1 AND revoked_at IS NULL`,
      [keyHash],
    );
    return r.rows[0] ?? null;
  }

  async listApiKeys(tenantId: string): Promise<ApiKey[]> {
    const r = await this.db.query<ApiKey>(
      `SELECT id, tenant_id, name, key_prefix, created_by, created_at, revoked_at
       FROM automation_api_keys WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return r.rows;
  }

  async revokeApiKey(id: string, tenantId: string): Promise<boolean> {
    const r = await this.db.query<{ id: string }>(
      `UPDATE automation_api_keys SET revoked_at = NOW()
       WHERE id = $1 AND tenant_id = $2 AND revoked_at IS NULL RETURNING id`,
      [id, tenantId],
    );
    return r.rows.length > 0;
  }

  async createWebhook(input: {
    tenant_id: string;
    name: string;
    url: string;
    events: string[];
    signing_secret: string;
    created_by?: string;
  }): Promise<AutomationWebhook> {
    const r = await this.db.query<AutomationWebhook>(
      `INSERT INTO automation_webhooks (tenant_id, name, url, events, signing_secret, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, tenant_id, name, url, events, created_by, created_at, revoked_at`,
      [input.tenant_id, input.name, input.url, input.events, input.signing_secret, input.created_by ?? null],
    );
    return r.rows[0]!;
  }

  async listWebhooks(tenantId: string): Promise<AutomationWebhook[]> {
    const r = await this.db.query<AutomationWebhook>(
      `SELECT id, tenant_id, name, url, events, created_by, created_at, revoked_at
       FROM automation_webhooks WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return r.rows;
  }

  async revokeWebhook(id: string, tenantId: string): Promise<boolean> {
    const r = await this.db.query<{ id: string }>(
      `UPDATE automation_webhooks SET revoked_at = NOW()
       WHERE id = $1 AND tenant_id = $2 AND revoked_at IS NULL RETURNING id`,
      [id, tenantId],
    );
    return r.rows.length > 0;
  }

  async findActiveWebhooksForEvent(
    tenantId: string,
    event: string,
  ): Promise<Array<{ id: string; url: string; signing_secret: string }>> {
    const r = await this.db.query<{ id: string; url: string; signing_secret: string }>(
      `SELECT id, url, signing_secret FROM automation_webhooks
       WHERE tenant_id = $1 AND revoked_at IS NULL AND $2 = ANY(events)`,
      [tenantId, event],
    );
    return r.rows;
  }
}
