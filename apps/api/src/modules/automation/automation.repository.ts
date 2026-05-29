import { createHash, createHmac, randomBytes } from 'node:crypto';
import type { Pool } from 'pg';
import type {
  ApiKey,
  AutomationWebhook,
  ClaimedWebhookDelivery,
  WebhookDeliveryAttempt,
  WebhookDeliveryQueueItem,
} from './automation.types.js';

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
       RETURNING id, tenant_id, name, url, events, failure_count, disabled_at, created_by, created_at, revoked_at`,
      [input.tenant_id, input.name, input.url, input.events, input.signing_secret, input.created_by ?? null],
    );
    return r.rows[0]!;
  }

  async listWebhooks(tenantId: string): Promise<AutomationWebhook[]> {
    const r = await this.db.query<AutomationWebhook>(
      `SELECT id, tenant_id, name, url, events, failure_count, disabled_at, created_by, created_at, revoked_at
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
       WHERE tenant_id = $1 AND revoked_at IS NULL AND disabled_at IS NULL AND $2 = ANY(events)`,
      [tenantId, event],
    );
    return r.rows;
  }

  async recordDeliveryFailure(id: string): Promise<void> {
    await this.db.query(
      `UPDATE automation_webhooks
       SET failure_count = failure_count + 1,
           disabled_at   = CASE WHEN failure_count + 1 >= 5 THEN NOW() ELSE disabled_at END
       WHERE id = $1 AND revoked_at IS NULL AND disabled_at IS NULL`,
      [id],
    );
  }

  async resetDeliveryFailure(id: string): Promise<void> {
    await this.db.query(
      `UPDATE automation_webhooks SET failure_count = 0 WHERE id = $1`,
      [id],
    );
  }

  async logDeliveryAttempt(input: {
    webhook_id: string;
    tenant_id: string;
    event: string;
    attempt_number: number;
    status: 'success' | 'failed';
    response_code: number | null;
    duration_ms: number | null;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO webhook_delivery_log
         (webhook_id, tenant_id, event, attempt_number, status, response_code, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        input.webhook_id,
        input.tenant_id,
        input.event,
        input.attempt_number,
        input.status,
        input.response_code,
        input.duration_ms,
      ],
    );
  }

  async enqueueWebhookDeliveries(input: {
    tenant_id: string;
    event: string;
    payload_json: Record<string, unknown>;
  }): Promise<WebhookDeliveryQueueItem[]> {
    const r = await this.db.query<WebhookDeliveryQueueItem>(
      `INSERT INTO webhook_delivery_queue (webhook_id, tenant_id, event, payload_json)
       SELECT id, tenant_id, $2, $3::jsonb
       FROM automation_webhooks
       WHERE tenant_id = $1
         AND revoked_at IS NULL
         AND disabled_at IS NULL
         AND $2 = ANY(events)
       RETURNING id, webhook_id, tenant_id, event, payload_json, status, attempt_count, max_attempts,
                 next_attempt_at, claimed_at, delivered_at, last_response_code, last_error, created_at, updated_at`,
      [input.tenant_id, input.event, JSON.stringify(input.payload_json)],
    );
    return r.rows;
  }

  async claimDueWebhookDeliveries(limit: number): Promise<ClaimedWebhookDelivery[]> {
    const r = await this.db.query<ClaimedWebhookDelivery>(
      `WITH due AS (
         SELECT q.id
         FROM webhook_delivery_queue q
         JOIN automation_webhooks w ON w.id = q.webhook_id
         WHERE q.status IN ('pending', 'failed')
           AND q.next_attempt_at <= NOW()
           AND q.attempt_count < q.max_attempts
           AND w.revoked_at IS NULL
           AND w.disabled_at IS NULL
         ORDER BY q.next_attempt_at ASC, q.created_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       UPDATE webhook_delivery_queue q
       SET status = 'processing',
           attempt_count = q.attempt_count + 1,
           claimed_at = NOW(),
           updated_at = NOW()
       FROM due, automation_webhooks w
       WHERE q.id = due.id
         AND w.id = q.webhook_id
       RETURNING q.id, q.webhook_id, q.tenant_id, q.event, q.payload_json, q.status, q.attempt_count,
                 q.max_attempts, q.next_attempt_at, q.claimed_at, q.delivered_at, q.last_response_code,
                 q.last_error, q.created_at, q.updated_at, w.url, w.signing_secret`,
      [limit],
    );
    return r.rows;
  }

  async markWebhookDeliveryDelivered(input: {
    delivery_id: string;
    response_code: number | null;
  }): Promise<void> {
    await this.db.query(
      `UPDATE webhook_delivery_queue
       SET status = 'delivered',
           delivered_at = NOW(),
           last_response_code = $2,
           last_error = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [input.delivery_id, input.response_code],
    );
  }

  async markWebhookDeliveryFailed(input: {
    delivery_id: string;
    response_code: number | null;
    error_message: string | null;
    retry_delay_seconds: number;
  }): Promise<void> {
    await this.db.query(
      `UPDATE webhook_delivery_queue
       SET status = CASE WHEN attempt_count >= max_attempts THEN 'abandoned' ELSE 'failed' END,
           next_attempt_at = CASE
             WHEN attempt_count >= max_attempts THEN next_attempt_at
             ELSE NOW() + ($4::text || ' seconds')::interval
           END,
           last_response_code = $2,
           last_error = LEFT($3, 500),
           updated_at = NOW()
       WHERE id = $1`,
      [input.delivery_id, input.response_code, input.error_message, input.retry_delay_seconds],
    );
  }

  async findDeliveryLog(webhookId: string, limit = 50): Promise<WebhookDeliveryAttempt[]> {
    const r = await this.db.query<WebhookDeliveryAttempt>(
      `SELECT id, webhook_id, tenant_id, event, attempt_number, status, response_code, duration_ms, attempted_at
       FROM webhook_delivery_log
       WHERE webhook_id = $1
       ORDER BY attempted_at DESC
       LIMIT $2`,
      [webhookId, limit],
    );
    return r.rows;
  }

  async findDeliveryQueueForWebhook(webhookId: string, tenantId: string, limit = 50): Promise<WebhookDeliveryQueueItem[]> {
    const r = await this.db.query<WebhookDeliveryQueueItem>(
      `SELECT id, webhook_id, tenant_id, event, payload_json, status, attempt_count, max_attempts,
              next_attempt_at, claimed_at, delivered_at, last_response_code, last_error, created_at, updated_at
       FROM webhook_delivery_queue
       WHERE webhook_id = $1 AND tenant_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [webhookId, tenantId, limit],
    );
    return r.rows;
  }

  async findWebhookById(id: string, tenantId: string): Promise<AutomationWebhook | null> {
    const r = await this.db.query<AutomationWebhook>(
      `SELECT id, tenant_id, name, url, events, failure_count, disabled_at, created_by, created_at, revoked_at
       FROM automation_webhooks WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return r.rows[0] ?? null;
  }
}
