import type { Pool } from 'pg';
import type { IngestRecordingInput, Recording } from './recording.types.js';

export class RecordingRepository {
  constructor(private readonly db: Pool) {}

  async create(input: IngestRecordingInput): Promise<Recording> {
    const result = await this.db.query<Recording>(
      `INSERT INTO call_recordings
         (tenant_id, call_id, call_event_id, storage_path, duration_secs, size_bytes, recorded_at)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, NOW()))
       RETURNING id, tenant_id, call_id, call_event_id, storage_path, duration_secs, size_bytes, status, recorded_at, created_at`,
      [
        input.tenant_id,
        input.call_id,
        input.call_event_id ?? null,
        input.storage_path,
        input.duration_secs ?? null,
        input.size_bytes ?? null,
        input.recorded_at ?? null,
      ],
    );
    return result.rows[0]!;
  }

  async listByTenant(tenantId: string, callId?: string): Promise<Recording[]> {
    const conditions = ['tenant_id = $1', "status != 'deleted'"];
    const values: unknown[] = [tenantId];
    if (callId) {
      conditions.push(`call_id = $2`);
      values.push(callId);
    }
    const result = await this.db.query<Recording>(
      `SELECT id, tenant_id, call_id, call_event_id, storage_path, duration_secs, size_bytes, status, recorded_at, created_at
       FROM call_recordings
       WHERE ${conditions.join(' AND ')}
       ORDER BY recorded_at DESC
       LIMIT 200`,
      values,
    );
    return result.rows;
  }

  async findById(id: string, tenantId: string): Promise<Recording | null> {
    const result = await this.db.query<Recording>(
      `SELECT id, tenant_id, call_id, call_event_id, storage_path, duration_secs, size_bytes, status, recorded_at, created_at
       FROM call_recordings
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }
}
