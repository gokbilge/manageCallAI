import type { Pool } from 'pg';

export interface IdempotencyRecord {
  id: string;
  tenant_id: string;
  idempotency_key: string;
  status_code: number;
  response_body: Record<string, unknown>;
  created_at: Date;
  expires_at: Date;
}

export class IdempotencyRepository {
  constructor(private readonly db: Pool) {}

  async find(tenantId: string, key: string): Promise<IdempotencyRecord | null> {
    const r = await this.db.query<IdempotencyRecord>(
      `SELECT id, tenant_id, idempotency_key, status_code, response_body, created_at, expires_at
       FROM idempotency_records
       WHERE tenant_id = $1 AND idempotency_key = $2 AND expires_at > NOW()`,
      [tenantId, key],
    );
    return r.rows[0] ?? null;
  }

  async store(
    tenantId: string,
    key: string,
    statusCode: number,
    body: Record<string, unknown>,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO idempotency_records (tenant_id, idempotency_key, status_code, response_body)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (tenant_id, idempotency_key) DO NOTHING`,
      [tenantId, key, statusCode, JSON.stringify(body)],
    );
  }

  async purgeExpired(): Promise<number> {
    const r = await this.db.query<{ count: string }>(
      `WITH deleted AS (
         DELETE FROM idempotency_records WHERE expires_at < NOW() RETURNING id
       ) SELECT COUNT(*) AS count FROM deleted`,
    );
    return parseInt(r.rows[0]?.count ?? '0', 10);
  }
}
