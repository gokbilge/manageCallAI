import type { Pool } from 'pg';
import type { CallEventRow } from './call-failure-explanation.types.js';

export class CallFailureExplanationRepository {
  constructor(private readonly db: Pool) {}

  async getCallEvents(callId: string, tenantId: string): Promise<CallEventRow[]> {
    const r = await this.db.query<CallEventRow>(
      `SELECT call_id, event_type, event_time, source, payload
       FROM call_events
       WHERE call_id = $1 AND tenant_id = $2
       ORDER BY event_time ASC, ingested_at ASC`,
      [callId, tenantId],
    );
    return r.rows;
  }
}
