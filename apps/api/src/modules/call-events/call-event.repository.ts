import type { Pool } from 'pg';
import type { CallEvent, IngestCallEventInput } from './call-event.types.js';

export class CallEventRepository {
  constructor(private readonly db: Pool) {}

  async listByTenant(tenantId: string): Promise<CallEvent[]> {
    const result = await this.db.query<CallEvent>(
      `SELECT * FROM call_events
       WHERE tenant_id = $1
       ORDER BY event_time DESC, ingested_at DESC`,
      [tenantId],
    );

    return result.rows;
  }

  async create(input: Required<Pick<IngestCallEventInput, 'call_id' | 'event_type'>> &
    Pick<IngestCallEventInput, 'event_time' | 'source' | 'payload'> & {
      tenant_id: string;
    }): Promise<CallEvent> {
    const result = await this.db.query<CallEvent>(
      `INSERT INTO call_events
         (tenant_id, call_id, event_type, event_time, source, payload)
       VALUES ($1, $2, $3, COALESCE($4::timestamptz, NOW()), $5, $6::jsonb)
       RETURNING *`,
      [
        input.tenant_id,
        input.call_id,
        input.event_type,
        input.event_time ?? null,
        input.source ?? 'freeswitch-esl',
        JSON.stringify(input.payload ?? {}),
      ],
    );

    return result.rows[0]!;
  }
}
