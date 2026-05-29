import type { Pool } from 'pg';
import type { CallEvent } from '../call-events/call-event.types.js';

const EXPORT_ROW_LIMIT = 1000;

export interface SessionExportRow {
  id: string;
  call_id: string;
  flow_id: string;
  flow_version_id: string;
  status: string;
  caller_number: string | null;
  destination_number: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface ExportFilter {
  since?: string;
  until?: string;
  limit?: number;
}

export class ExportRepository {
  constructor(private readonly db: Pool) {}

  async exportCallEvents(tenantId: string, filter: ExportFilter): Promise<CallEvent[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const values: unknown[] = [tenantId];
    let idx = 2;

    if (filter.since) {
      conditions.push(`event_time >= $${idx++}`);
      values.push(filter.since);
    }
    if (filter.until) {
      conditions.push(`event_time <= $${idx++}`);
      values.push(filter.until);
    }

    const limit = Math.min(filter.limit ?? EXPORT_ROW_LIMIT, EXPORT_ROW_LIMIT);
    const result = await this.db.query<CallEvent>(
      `SELECT id, tenant_id, call_id, event_type, event_time, source, payload, ingested_at
       FROM call_events
       WHERE ${conditions.join(' AND ')}
       ORDER BY event_time DESC
       LIMIT ${limit}`,
      values,
    );
    return result.rows;
  }

  async exportSessions(tenantId: string, filter: ExportFilter): Promise<SessionExportRow[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const values: unknown[] = [tenantId];
    let idx = 2;

    if (filter.since) {
      conditions.push(`created_at >= $${idx++}`);
      values.push(filter.since);
    }
    if (filter.until) {
      conditions.push(`created_at <= $${idx++}`);
      values.push(filter.until);
    }

    const limit = Math.min(filter.limit ?? EXPORT_ROW_LIMIT, EXPORT_ROW_LIMIT);
    const result = await this.db.query<SessionExportRow>(
      `SELECT id, call_id, flow_id, flow_version_id, status,
              caller_number, destination_number, created_at, completed_at
       FROM ivr_flow_sessions
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT ${limit}`,
      values,
    );
    return result.rows;
  }
}
