import { Pool } from 'pg';

export interface AuditLogEntry {
  id: string;
  tenant_id: string;
  actor_id: string | null;
  actor_role: string | null;
  actor_type: string | null;
  request_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata_json: Record<string, unknown> | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}

export interface LogAuditEventInput {
  tenant_id: string;
  actor_id?: string | null;
  actor_role?: string | null;
  actor_type?: 'user' | 'api_key' | 'system' | 'runtime' | null;
  request_id?: string | null;
  action: string;
  resource_type: string;
  resource_id?: string | null;
  metadata?: Record<string, unknown> | null;
  old_value?: Record<string, unknown> | null;
  new_value?: Record<string, unknown> | null;
}

export interface AuditLogFilter {
  action?: string;
  resource_type?: string;
  resource_id?: string;
  actor_id?: string;
  since?: string;
  limit?: number;
}

export class AuditRepository {
  constructor(private readonly db: Pool) {}

  async log(input: LogAuditEventInput): Promise<void> {
    await this.db.query(
      `INSERT INTO tenant_audit_log
         (tenant_id, actor_id, actor_role, actor_type, request_id,
          action, resource_type, resource_id, metadata_json, old_value, new_value)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        input.tenant_id,
        input.actor_id ?? null,
        input.actor_role ?? null,
        input.actor_type ?? null,
        input.request_id ?? null,
        input.action,
        input.resource_type,
        input.resource_id ?? null,
        input.metadata ? JSON.stringify(input.metadata) : null,
        input.old_value ? JSON.stringify(input.old_value) : null,
        input.new_value ? JSON.stringify(input.new_value) : null,
      ],
    );
  }

  async find(tenantId: string, filter: AuditLogFilter = {}): Promise<AuditLogEntry[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const values: unknown[] = [tenantId];
    let idx = 2;

    if (filter.action) {
      conditions.push(`action = $${idx++}`);
      values.push(filter.action);
    }
    if (filter.resource_type) {
      conditions.push(`resource_type = $${idx++}`);
      values.push(filter.resource_type);
    }
    if (filter.resource_id) {
      conditions.push(`resource_id = $${idx++}`);
      values.push(filter.resource_id);
    }
    if (filter.actor_id) {
      conditions.push(`actor_id = $${idx++}`);
      values.push(filter.actor_id);
    }
    if (filter.since) {
      conditions.push(`created_at >= $${idx++}`);
      values.push(filter.since);
    }

    const limit = Math.min(filter.limit ?? 100, 500);
    const result = await this.db.query<AuditLogEntry>(
      `SELECT id, tenant_id, actor_id, actor_role, actor_type, request_id,
              action, resource_type, resource_id, metadata_json,
              old_value, new_value, created_at
       FROM tenant_audit_log
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT ${limit}`,
      values,
    );
    return result.rows;
  }
}
