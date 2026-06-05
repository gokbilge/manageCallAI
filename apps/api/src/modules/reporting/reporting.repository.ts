import type { Pool } from 'pg';
import type { CallDirection, CallStatus, ReportCallRow, TimeRange } from './reporting.types.js';

const OUTBOUND_EVENT_TYPES = [
  'outbound_call_dispatched',
  'outbound_call_completed',
  'outbound_call_failed',
];

export class ReportingRepository {
  constructor(private readonly db: Pool) {}

  async queryCallEvents(
    tenantId: string,
    opts: {
      direction?: CallDirection;
      status?: CallStatus;
      time_range?: TimeRange;
      limit: number;
    },
  ): Promise<ReportCallRow[]> {
    const conditions: string[] = ['tenant_id = $1'];
    const values: unknown[] = [tenantId];
    let idx = 2;

    if (opts.direction === 'outbound') {
      conditions.push(`event_type = ANY($${idx++}::text[])`);
      values.push(OUTBOUND_EVENT_TYPES);
    } else if (opts.direction === 'inbound') {
      conditions.push(`event_type != ALL($${idx++}::text[])`);
      values.push(OUTBOUND_EVENT_TYPES);
    }

    if (opts.status === 'failed') {
      conditions.push(`event_type LIKE '%_failed'`);
    } else if (opts.status === 'completed') {
      conditions.push(`(event_type LIKE '%_completed' OR event_type = 'CHANNEL_DESTROY')`);
    } else if (opts.status === 'active') {
      conditions.push(`event_time >= NOW() - INTERVAL '5 minutes'`);
    }

    if (opts.time_range === 'last_hour') {
      conditions.push(`event_time >= NOW() - INTERVAL '1 hour'`);
    } else if (opts.time_range === 'today') {
      conditions.push(`event_time >= CURRENT_DATE`);
    } else if (opts.time_range === 'yesterday') {
      conditions.push(`event_time >= CURRENT_DATE - INTERVAL '1 day' AND event_time < CURRENT_DATE`);
    } else if (opts.time_range === 'last_7_days') {
      conditions.push(`event_time >= NOW() - INTERVAL '7 days'`);
    } else {
      // Default: last 24 hours to bound result size
      conditions.push(`event_time >= NOW() - INTERVAL '24 hours'`);
    }

    const r = await this.db.query<{ call_id: string; event_type: string; event_time: Date; source: string | null }>(
      `SELECT call_id, event_type, event_time, source
       FROM call_events
       WHERE ${conditions.join(' AND ')}
       ORDER BY event_time DESC
       LIMIT $${idx}`,
      [...values, opts.limit],
    );
    return r.rows.map(row => ({
      call_id: row.call_id,
      event_type: row.event_type,
      event_time: row.event_time instanceof Date ? row.event_time.toISOString() : String(row.event_time),
      source: row.source,
    }));
  }

  async countCallEvents(
    tenantId: string,
    opts: {
      direction?: CallDirection;
      status?: CallStatus;
      time_range?: TimeRange;
    },
  ): Promise<number> {
    const rows = await this.queryCallEvents(tenantId, { ...opts, limit: 10000 });
    return rows.length;
  }
}
