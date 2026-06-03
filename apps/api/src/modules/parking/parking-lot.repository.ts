import type { Pool } from 'pg';
import type {
  CreateParkingLotInput,
  ParkCallInput,
  ParkedCall,
  ParkingLot,
  UpdateParkingLotInput,
} from './parking-lot.types.js';

const LOT_COLS = `id, tenant_id, name, slot_range_start, slot_range_end, timeout_seconds, created_at, updated_at`;
const CALL_COLS = `id, tenant_id, parking_lot_id, slot, call_id, parked_by, status, parked_at, timeout_at, retrieved_at, created_at, updated_at`;

export class ParkingLotRepository {
  constructor(private readonly db: Pool) {}

  async findAllByTenant(tenantId: string): Promise<ParkingLot[]> {
    const r = await this.db.query<ParkingLot>(
      `SELECT ${LOT_COLS} FROM parking_lots WHERE tenant_id = $1 ORDER BY name`,
      [tenantId],
    );
    return r.rows;
  }

  async findById(id: string, tenantId: string): Promise<ParkingLot | null> {
    const r = await this.db.query<ParkingLot>(
      `SELECT ${LOT_COLS} FROM parking_lots WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async findByTenantAndSlot(tenantId: string, slot: number): Promise<ParkingLot | null> {
    const r = await this.db.query<ParkingLot>(
      `SELECT ${LOT_COLS} FROM parking_lots
       WHERE tenant_id = $1 AND slot_range_start <= $2 AND slot_range_end >= $2`,
      [tenantId, slot],
    );
    return r.rows[0] ?? null;
  }

  async create(input: CreateParkingLotInput): Promise<ParkingLot> {
    const r = await this.db.query<ParkingLot>(
      `INSERT INTO parking_lots (tenant_id, name, slot_range_start, slot_range_end, timeout_seconds)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${LOT_COLS}`,
      [
        input.tenant_id,
        input.name,
        input.slot_range_start ?? 801,
        input.slot_range_end ?? 820,
        input.timeout_seconds ?? 300,
      ],
    );
    return r.rows[0]!;
  }

  async update(id: string, tenantId: string, input: UpdateParkingLotInput): Promise<ParkingLot | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.name !== undefined) { fields.push(`name = $${idx++}`); values.push(input.name); }
    if (input.slot_range_start !== undefined) { fields.push(`slot_range_start = $${idx++}`); values.push(input.slot_range_start); }
    if (input.slot_range_end !== undefined) { fields.push(`slot_range_end = $${idx++}`); values.push(input.slot_range_end); }
    if (input.timeout_seconds !== undefined) { fields.push(`timeout_seconds = $${idx++}`); values.push(input.timeout_seconds); }

    if (fields.length === 0) return this.findById(id, tenantId);

    fields.push(`updated_at = NOW()`);
    values.push(id, tenantId);
    const r = await this.db.query<ParkingLot>(
      `UPDATE parking_lots SET ${fields.join(', ')}
       WHERE id = $${idx} AND tenant_id = $${idx + 1}
       RETURNING ${LOT_COLS}`,
      values,
    );
    return r.rows[0] ?? null;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const r = await this.db.query(
      `DELETE FROM parking_lots WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return (r.rowCount ?? 0) > 0;
  }

  // Parked call operations
  async findParkedCallsByLot(lotId: string, tenantId: string): Promise<ParkedCall[]> {
    const r = await this.db.query<ParkedCall>(
      `SELECT ${CALL_COLS} FROM parked_calls
       WHERE parking_lot_id = $1 AND tenant_id = $2 AND status = 'parked'
       ORDER BY parked_at ASC`,
      [lotId, tenantId],
    );
    return r.rows;
  }

  async findActiveParkedCallBySlot(tenantId: string, slot: number): Promise<ParkedCall | null> {
    const r = await this.db.query<ParkedCall>(
      `SELECT ${CALL_COLS} FROM parked_calls
       WHERE tenant_id = $1 AND slot = $2 AND status = 'parked'`,
      [tenantId, slot],
    );
    return r.rows[0] ?? null;
  }

  async parkCall(input: ParkCallInput, lotId: string, timeoutSeconds: number): Promise<ParkedCall> {
    const timeoutAt = new Date(Date.now() + timeoutSeconds * 1000);
    const r = await this.db.query<ParkedCall>(
      `INSERT INTO parked_calls
         (tenant_id, parking_lot_id, slot, call_id, parked_by, timeout_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${CALL_COLS}`,
      [input.tenant_id, lotId, input.slot, input.call_id, input.parked_by ?? null, timeoutAt],
    );
    return r.rows[0]!;
  }

  async retrieveCall(tenantId: string, slot: number): Promise<ParkedCall | null> {
    const r = await this.db.query<ParkedCall>(
      `UPDATE parked_calls
       SET status = 'retrieved', retrieved_at = NOW(), updated_at = NOW()
       WHERE tenant_id = $1 AND slot = $2 AND status = 'parked'
       RETURNING ${CALL_COLS}`,
      [tenantId, slot],
    );
    return r.rows[0] ?? null;
  }

  async timeoutCall(tenantId: string, slot: number): Promise<ParkedCall | null> {
    const r = await this.db.query<ParkedCall>(
      `UPDATE parked_calls
       SET status = 'timed_out', updated_at = NOW()
       WHERE tenant_id = $1 AND slot = $2 AND status = 'parked'
       RETURNING ${CALL_COLS}`,
      [tenantId, slot],
    );
    return r.rows[0] ?? null;
  }
}
