import type { Pool } from 'pg';
import type {
  ConferenceParticipant,
  ConferenceRoom,
  ConferenceRoomInternal,
  CreateConferenceRoomInput,
  UpdateConferenceRoomInput,
} from './conference-room.types.js';

const PUBLIC_COLS = `
  id, tenant_id, name, room_number,
  (pin_ciphertext IS NOT NULL) AS has_pin,
  max_participants, record_calls, status, created_by, created_at, updated_at
`;

const INTERNAL_COLS = `
  id, tenant_id, name, room_number,
  pin_ciphertext, pin_key_id,
  (pin_ciphertext IS NOT NULL) AS has_pin,
  max_participants, record_calls, status, created_by, created_at, updated_at
`;

const PART_COLS = `id, tenant_id, conference_room_id, call_id, joined_at, left_at`;

export class ConferenceRoomRepository {
  constructor(private readonly db: Pool) {}

  async findAllByTenant(tenantId: string): Promise<ConferenceRoom[]> {
    const r = await this.db.query<ConferenceRoom>(
      `SELECT ${PUBLIC_COLS} FROM conference_rooms WHERE tenant_id = $1 ORDER BY room_number`,
      [tenantId],
    );
    return r.rows;
  }

  async findById(id: string, tenantId: string): Promise<ConferenceRoom | null> {
    const r = await this.db.query<ConferenceRoom>(
      `SELECT ${PUBLIC_COLS} FROM conference_rooms WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return r.rows[0] ?? null;
  }

  // Returns internal row with encrypted PIN — for FreeSWITCH mod_xml_curl only.
  async findInternalByRoomNumber(roomNumber: string, tenantId: string): Promise<ConferenceRoomInternal | null> {
    const r = await this.db.query<ConferenceRoomInternal>(
      `SELECT ${INTERNAL_COLS} FROM conference_rooms
       WHERE room_number = $1 AND tenant_id = $2 AND status = 'active'`,
      [roomNumber, tenantId],
    );
    return r.rows[0] ?? null;
  }

  // Returns all active rooms for a tenant — used by FreeSWITCH dialplan serving.
  async findAllActiveByTenant(tenantId: string): Promise<ConferenceRoomInternal[]> {
    const r = await this.db.query<ConferenceRoomInternal>(
      `SELECT ${INTERNAL_COLS} FROM conference_rooms
       WHERE tenant_id = $1 AND status = 'active'
       ORDER BY room_number`,
      [tenantId],
    );
    return r.rows;
  }

  async create(
    input: CreateConferenceRoomInput,
    pinCiphertext: string | null,
    pinKeyId: string | null,
  ): Promise<ConferenceRoom> {
    const r = await this.db.query<ConferenceRoom>(
      `INSERT INTO conference_rooms
         (tenant_id, name, room_number, pin_ciphertext, pin_key_id,
          max_participants, record_calls, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${PUBLIC_COLS}`,
      [
        input.tenant_id,
        input.name,
        input.room_number,
        pinCiphertext,
        pinKeyId,
        input.max_participants ?? 20,
        input.record_calls ?? false,
        input.created_by ?? null,
      ],
    );
    return r.rows[0]!;
  }

  async update(
    id: string,
    tenantId: string,
    input: UpdateConferenceRoomInput,
    pinCiphertext: string | null | undefined,
    pinKeyId: string | null | undefined,
  ): Promise<ConferenceRoom | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.name !== undefined) { fields.push(`name = $${idx++}`); values.push(input.name); }
    if (input.max_participants !== undefined) { fields.push(`max_participants = $${idx++}`); values.push(input.max_participants); }
    if (input.record_calls !== undefined) { fields.push(`record_calls = $${idx++}`); values.push(input.record_calls); }
    if ('pin' in input) {
      // Explicit PIN update (including clearing it)
      fields.push(`pin_ciphertext = $${idx++}`);
      values.push(pinCiphertext ?? null);
      fields.push(`pin_key_id = $${idx++}`);
      values.push(pinKeyId ?? null);
    }

    if (fields.length === 0) return this.findById(id, tenantId);

    fields.push(`updated_at = NOW()`);
    values.push(id, tenantId);

    const r = await this.db.query<ConferenceRoom>(
      `UPDATE conference_rooms SET ${fields.join(', ')}
       WHERE id = $${idx} AND tenant_id = $${idx + 1}
       RETURNING ${PUBLIC_COLS}`,
      values,
    );
    return r.rows[0] ?? null;
  }

  async setStatus(id: string, tenantId: string, status: 'active' | 'disabled'): Promise<ConferenceRoom | null> {
    const r = await this.db.query<ConferenceRoom>(
      `UPDATE conference_rooms SET status = $3, updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING ${PUBLIC_COLS}`,
      [id, tenantId, status],
    );
    return r.rows[0] ?? null;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const r = await this.db.query(
      `DELETE FROM conference_rooms WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return (r.rowCount ?? 0) > 0;
  }

  // Participant snapshot operations
  async recordJoin(tenantId: string, roomId: string, callId: string): Promise<ConferenceParticipant> {
    const r = await this.db.query<ConferenceParticipant>(
      `INSERT INTO conference_participant_snapshots (tenant_id, conference_room_id, call_id)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING
       RETURNING ${PART_COLS}`,
      [tenantId, roomId, callId],
    );
    if (!r.rows[0]) {
      // Already exists; return the existing row
      const existing = await this.db.query<ConferenceParticipant>(
        `SELECT ${PART_COLS} FROM conference_participant_snapshots
         WHERE tenant_id = $1 AND conference_room_id = $2 AND call_id = $3`,
        [tenantId, roomId, callId],
      );
      return existing.rows[0]!;
    }
    return r.rows[0]!;
  }

  async recordLeave(tenantId: string, roomId: string, callId: string): Promise<ConferenceParticipant | null> {
    const r = await this.db.query<ConferenceParticipant>(
      `UPDATE conference_participant_snapshots
       SET left_at = NOW()
       WHERE tenant_id = $1 AND conference_room_id = $2 AND call_id = $3 AND left_at IS NULL
       RETURNING ${PART_COLS}`,
      [tenantId, roomId, callId],
    );
    return r.rows[0] ?? null;
  }

  async findParticipants(roomId: string, tenantId: string): Promise<ConferenceParticipant[]> {
    const r = await this.db.query<ConferenceParticipant>(
      `SELECT ${PART_COLS} FROM conference_participant_snapshots
       WHERE conference_room_id = $1 AND tenant_id = $2 AND left_at IS NULL
       ORDER BY joined_at`,
      [roomId, tenantId],
    );
    return r.rows;
  }
}
