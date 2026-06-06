import type { Pool } from 'pg';
import type {
  CallbackStatus,
  CreateQueueCallbackInput,
  QueueCallback,
  UpdateQueueCallbackInput,
} from './queue-callbacks.types.js';

const COLS = `id, tenant_id, queue_id, caller_phone, caller_name,
  scheduled_at, retry_count, max_retries, status, created_at, updated_at`;

export class QueueCallbacksRepository {
  constructor(private readonly db: Pool) {}

  async findAllByTenant(tenantId: string): Promise<QueueCallback[]> {
    const r = await this.db.query<QueueCallback>(
      `SELECT ${COLS} FROM queue_callbacks WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return r.rows;
  }

  async findByQueue(queueId: string, tenantId: string): Promise<QueueCallback[]> {
    const r = await this.db.query<QueueCallback>(
      `SELECT ${COLS} FROM queue_callbacks
       WHERE queue_id = $1 AND tenant_id = $2 ORDER BY created_at DESC`,
      [queueId, tenantId],
    );
    return r.rows;
  }

  async findById(id: string, tenantId: string): Promise<QueueCallback | null> {
    const r = await this.db.query<QueueCallback>(
      `SELECT ${COLS} FROM queue_callbacks WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async create(input: CreateQueueCallbackInput): Promise<QueueCallback> {
    const r = await this.db.query<QueueCallback>(
      `INSERT INTO queue_callbacks
         (tenant_id, queue_id, caller_phone, caller_name, scheduled_at, max_retries)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${COLS}`,
      [
        input.tenant_id,
        input.queue_id,
        input.caller_phone,
        input.caller_name ?? null,
        input.scheduled_at ?? null,
        input.max_retries ?? 3,
      ],
    );
    return r.rows[0]!;
  }

  async update(id: string, tenantId: string, input: UpdateQueueCallbackInput): Promise<QueueCallback | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(input.status);
      if (input.status === 'pending') {
        fields.push(`retry_count = retry_count + 1`);
      }
    }
    if ('scheduled_at' in input) {
      fields.push(`scheduled_at = $${idx++}`);
      values.push(input.scheduled_at ?? null);
    }
    if ('caller_name' in input) {
      fields.push(`caller_name = $${idx++}`);
      values.push(input.caller_name ?? null);
    }

    if (fields.length === 0) return this.findById(id, tenantId);

    fields.push('updated_at = NOW()');
    values.push(id, tenantId);
    const r = await this.db.query<QueueCallback>(
      `UPDATE queue_callbacks SET ${fields.join(', ')}
       WHERE id = $${idx} AND tenant_id = $${idx + 1}
       RETURNING ${COLS}`,
      values,
    );
    return r.rows[0] ?? null;
  }

  async findActiveByStatus(tenantId: string, statuses: CallbackStatus[]): Promise<QueueCallback[]> {
    const placeholders = statuses.map((_, i) => `$${i + 2}`).join(', ');
    const r = await this.db.query<QueueCallback>(
      `SELECT ${COLS} FROM queue_callbacks
       WHERE tenant_id = $1 AND status IN (${placeholders}) ORDER BY created_at`,
      [tenantId, ...statuses],
    );
    return r.rows;
  }

  async findQueueExists(queueId: string, tenantId: string): Promise<boolean> {
    const r = await this.db.query<{ id: string }>(
      `SELECT id FROM queues WHERE id = $1 AND tenant_id = $2`,
      [queueId, tenantId],
    );
    return r.rows.length > 0;
  }
}
