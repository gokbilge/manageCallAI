import type { Pool } from 'pg';
import type { CreateMeetingSessionInput, MeetingSession, UpdateMeetingSessionInput } from './meeting-session.types.js';

const COLUMNS = `id, tenant_id, channel_account_id, meeting_code, meeting_url, status, participant_count, recording_reference, transcript_reference, provider_metadata, started_at, ended_at, created_at, updated_at`;

export class MeetingSessionRepository {
  constructor(private readonly db: Pool) {}

  async create(input: CreateMeetingSessionInput): Promise<MeetingSession> {
    const r = await this.db.query<MeetingSession>(
      `INSERT INTO meeting_sessions (tenant_id, channel_account_id, meeting_code, meeting_url, provider_metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${COLUMNS}`,
      [
        input.tenant_id,
        input.channel_account_id,
        input.meeting_code ?? null,
        input.meeting_url ?? null,
        JSON.stringify(input.provider_metadata ?? {}),
      ],
    );
    return r.rows[0]!;
  }

  async findById(id: string, tenantId: string): Promise<MeetingSession | null> {
    const r = await this.db.query<MeetingSession>(
      `SELECT ${COLUMNS} FROM meeting_sessions WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async findByTenant(tenantId: string, limit = 100): Promise<MeetingSession[]> {
    const r = await this.db.query<MeetingSession>(
      `SELECT ${COLUMNS} FROM meeting_sessions WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [tenantId, limit],
    );
    return r.rows;
  }

  async update(id: string, tenantId: string, input: UpdateMeetingSessionInput): Promise<MeetingSession | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (input.status !== undefined) { sets.push(`status = $${i++}`); params.push(input.status); }
    if (input.meeting_url !== undefined) { sets.push(`meeting_url = $${i++}`); params.push(input.meeting_url); }
    if (input.participant_count !== undefined) { sets.push(`participant_count = $${i++}`); params.push(input.participant_count); }
    if (input.recording_reference !== undefined) { sets.push(`recording_reference = $${i++}`); params.push(input.recording_reference); }
    if (input.transcript_reference !== undefined) { sets.push(`transcript_reference = $${i++}`); params.push(input.transcript_reference); }
    if (input.provider_metadata !== undefined) { sets.push(`provider_metadata = $${i++}`); params.push(JSON.stringify(input.provider_metadata)); }
    if (input.started_at !== undefined) { sets.push(`started_at = $${i++}`); params.push(input.started_at); }
    if (input.ended_at !== undefined) { sets.push(`ended_at = $${i++}`); params.push(input.ended_at); }
    sets.push(`updated_at = NOW()`);
    params.push(id, tenantId);
    const r = await this.db.query<MeetingSession>(
      `UPDATE meeting_sessions SET ${sets.join(', ')}
       WHERE id = $${i++} AND tenant_id = $${i}
       RETURNING ${COLUMNS}`,
      params,
    );
    return r.rows[0] ?? null;
  }

  async findChannelAccount(tenantId: string, channelAccountId: string): Promise<{ id: string } | null> {
    const r = await this.db.query<{ id: string }>(
      `SELECT id FROM channel_accounts WHERE id = $1 AND tenant_id = $2 AND status = 'active'`,
      [channelAccountId, tenantId],
    );
    return r.rows[0] ?? null;
  }
}
