import type { Pool } from 'pg';
import type {
  AssignInput,
  Device,
  DeviceRegistration,
  DeviceStatus,
  ExtensionAssignment,
  RecordRegistrationInput,
  UpdateDeviceInput,
} from './device.types.js';

const devCols = `id, tenant_id, name, device_type, mac_address, sip_username, status, metadata, created_at, updated_at`;
const regCols = `id, tenant_id, device_id, extension_id, sip_username, registered_at, expires_at, contact_uri, user_agent, source_ip, is_active`;
const assignCols = `id, tenant_id, extension_id, assignable_type, assignable_id, is_primary, created_at`;

export class DeviceRepository {
  constructor(private readonly db: Pool) {}

  // ── Devices (#308) ────────────────────────────────────────────────────────

  async create(
    tenantId: string,
    name: string,
    deviceType: string,
    macAddress: string | null,
    sipUsername: string | null,
    sipPasswordCiphertext: string | null,
    sipPasswordKeyId: string | null,
    metadata: Record<string, unknown>,
  ): Promise<Device> {
    const r = await this.db.query<Device>(
      `INSERT INTO devices (tenant_id, name, device_type, mac_address, sip_username, sip_password_ciphertext, sip_password_key_id, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING ${devCols}`,
      [tenantId, name, deviceType, macAddress, sipUsername, sipPasswordCiphertext, sipPasswordKeyId, JSON.stringify(metadata)],
    );
    return r.rows[0]!;
  }

  async findAll(tenantId: string): Promise<Device[]> {
    const r = await this.db.query<Device>(
      `SELECT ${devCols} FROM devices WHERE tenant_id = $1 ORDER BY name`,
      [tenantId],
    );
    return r.rows;
  }

  async findById(id: string, tenantId: string): Promise<Device | null> {
    const r = await this.db.query<Device>(
      `SELECT ${devCols} FROM devices WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async update(id: string, tenantId: string, input: UpdateDeviceInput, ciphertext?: string, keyId?: string): Promise<Device | null> {
    const sets: string[] = ['updated_at = NOW()'];
    const vals: unknown[] = [id, tenantId];
    let i = 3;
    if (input.name !== undefined)        { sets.push(`name = $${i}`);         vals.push(input.name);        i++; }
    if (input.device_type !== undefined) { sets.push(`device_type = $${i}`);  vals.push(input.device_type); i++; }
    if (input.mac_address !== undefined) { sets.push(`mac_address = $${i}`);  vals.push(input.mac_address); i++; }
    if (input.sip_username !== undefined){ sets.push(`sip_username = $${i}`); vals.push(input.sip_username);i++; }
    if (input.status !== undefined)      { sets.push(`status = $${i}`);       vals.push(input.status);      i++; }
    if (input.metadata !== undefined)    { sets.push(`metadata = $${i}::jsonb`); vals.push(JSON.stringify(input.metadata)); i++; }
    if (ciphertext)                      { sets.push(`sip_password_ciphertext = $${i}`); vals.push(ciphertext); i++; }
    if (keyId)                           { sets.push(`sip_password_key_id = $${i}`);     vals.push(keyId);      i++; }
    const r = await this.db.query<Device>(
      `UPDATE devices SET ${sets.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING ${devCols}`,
      vals,
    );
    return r.rows[0] ?? null;
  }

  async updateStatus(id: string, tenantId: string, status: DeviceStatus): Promise<Device | null> {
    const r = await this.db.query<Device>(
      `UPDATE devices SET status = $3, updated_at = NOW() WHERE id = $1 AND tenant_id = $2 RETURNING ${devCols}`,
      [id, tenantId, status],
    );
    return r.rows[0] ?? null;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const r = await this.db.query(`DELETE FROM devices WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    return (r.rowCount ?? 0) > 0;
  }

  // ── Registrations (#309) ──────────────────────────────────────────────────

  async recordRegistration(tenantId: string, input: RecordRegistrationInput): Promise<DeviceRegistration> {
    // Expire any existing active registrations for this sip_username
    await this.db.query(
      `UPDATE device_registrations SET is_active = false
       WHERE tenant_id = $1 AND sip_username = $2 AND is_active = true`,
      [tenantId, input.sip_username],
    );

    const r = await this.db.query<DeviceRegistration>(
      `INSERT INTO device_registrations
         (tenant_id, device_id, extension_id, sip_username, expires_at, contact_uri, user_agent, source_ip)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING ${regCols}`,
      [
        tenantId,
        input.device_id ?? null,
        input.extension_id ?? null,
        input.sip_username,
        input.expires_at ?? null,
        input.contact_uri ?? null,
        input.user_agent ?? null,
        input.source_ip ?? null,
      ],
    );
    return r.rows[0]!;
  }

  async listRegistrations(tenantId: string, deviceId?: string, extensionId?: string): Promise<DeviceRegistration[]> {
    const conditions = ['tenant_id = $1'];
    const vals: unknown[] = [tenantId];
    let i = 2;
    if (deviceId)   { conditions.push(`device_id = $${i}`);   vals.push(deviceId);   i++; }
    if (extensionId){ conditions.push(`extension_id = $${i}`); vals.push(extensionId);i++; }

    const r = await this.db.query<DeviceRegistration>(
      `SELECT ${regCols} FROM device_registrations WHERE ${conditions.join(' AND ')} ORDER BY registered_at DESC LIMIT 100`,
      vals,
    );
    return r.rows;
  }

  async expireRegistration(id: string, tenantId: string): Promise<boolean> {
    const r = await this.db.query(
      `UPDATE device_registrations SET is_active = false WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return (r.rowCount ?? 0) > 0;
  }

  // ── Assignments (#310) ────────────────────────────────────────────────────

  async assign(tenantId: string, input: AssignInput): Promise<ExtensionAssignment> {
    const r = await this.db.query<ExtensionAssignment>(
      `INSERT INTO extension_assignments (tenant_id, extension_id, assignable_type, assignable_id, is_primary)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (tenant_id, extension_id, assignable_type, assignable_id) DO UPDATE SET is_primary = EXCLUDED.is_primary
       RETURNING ${assignCols}`,
      [tenantId, input.extension_id, input.assignable_type, input.assignable_id, input.is_primary ?? false],
    );
    return r.rows[0]!;
  }

  async unassign(id: string, tenantId: string): Promise<boolean> {
    const r = await this.db.query(
      `DELETE FROM extension_assignments WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return (r.rowCount ?? 0) > 0;
  }

  async listAssignments(tenantId: string, extensionId: string): Promise<ExtensionAssignment[]> {
    const r = await this.db.query<ExtensionAssignment>(
      `SELECT ${assignCols} FROM extension_assignments WHERE tenant_id = $1 AND extension_id = $2 ORDER BY assignable_type, is_primary DESC`,
      [tenantId, extensionId],
    );
    return r.rows;
  }

  async listAssignmentsByAssignable(tenantId: string, assignableType: 'user' | 'device', assignableId: string): Promise<ExtensionAssignment[]> {
    const r = await this.db.query<ExtensionAssignment>(
      `SELECT ${assignCols} FROM extension_assignments WHERE tenant_id = $1 AND assignable_type = $2 AND assignable_id = $3`,
      [tenantId, assignableType, assignableId],
    );
    return r.rows;
  }
}
