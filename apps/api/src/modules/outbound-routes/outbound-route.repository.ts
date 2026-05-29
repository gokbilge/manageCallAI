import type { Pool } from 'pg';
import type {
  CreateOutboundRouteInput,
  OutboundRoute,
  ResolvedOutboundRoute,
  UpdateOutboundRouteInput,
} from './outbound-route.types.js';

const COLUMNS = `id, tenant_id, name, status, match_prefix, priority, sip_trunk_id, fallback_sip_trunk_id, max_calls_per_minute, allowed_caller_id_numbers_json, created_at, updated_at`;

export class OutboundRouteRepository {
  constructor(private readonly db: Pool) {}

  async findAllByTenant(tenantId: string): Promise<OutboundRoute[]> {
    const r = await this.db.query<OutboundRoute>(
      `SELECT ${COLUMNS} FROM outbound_routes WHERE tenant_id = $1 ORDER BY priority ASC, created_at DESC`,
      [tenantId],
    );
    return r.rows;
  }

  async findById(id: string, tenantId: string): Promise<OutboundRoute | null> {
    const r = await this.db.query<OutboundRoute>(
      `SELECT ${COLUMNS} FROM outbound_routes WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async create(input: CreateOutboundRouteInput): Promise<OutboundRoute> {
    const r = await this.db.query<OutboundRoute>(
      `INSERT INTO outbound_routes
         (tenant_id, name, match_prefix, priority, sip_trunk_id, fallback_sip_trunk_id, max_calls_per_minute, allowed_caller_id_numbers_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       RETURNING ${COLUMNS}`,
      [
        input.tenant_id,
        input.name,
        input.match_prefix,
        input.priority ?? 100,
        input.sip_trunk_id,
        input.fallback_sip_trunk_id ?? null,
        input.max_calls_per_minute ?? null,
        input.allowed_caller_id_numbers_json ? JSON.stringify(input.allowed_caller_id_numbers_json) : null,
      ],
    );
    return r.rows[0]!;
  }

  async update(id: string, tenantId: string, input: UpdateOutboundRouteInput): Promise<OutboundRoute | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.name !== undefined) { fields.push(`name = $${idx++}`); values.push(input.name); }
    if (input.match_prefix !== undefined) { fields.push(`match_prefix = $${idx++}`); values.push(input.match_prefix); }
    if (input.priority !== undefined) { fields.push(`priority = $${idx++}`); values.push(input.priority); }
    if (input.sip_trunk_id !== undefined) { fields.push(`sip_trunk_id = $${idx++}`); values.push(input.sip_trunk_id); }
    if ('fallback_sip_trunk_id' in input) { fields.push(`fallback_sip_trunk_id = $${idx++}`); values.push(input.fallback_sip_trunk_id ?? null); }
    if ('max_calls_per_minute' in input) { fields.push(`max_calls_per_minute = $${idx++}`); values.push(input.max_calls_per_minute ?? null); }
    if ('allowed_caller_id_numbers_json' in input) {
      fields.push(`allowed_caller_id_numbers_json = $${idx++}::jsonb`);
      values.push(input.allowed_caller_id_numbers_json ? JSON.stringify(input.allowed_caller_id_numbers_json) : null);
    }
    if (input.status !== undefined) { fields.push(`status = $${idx++}`); values.push(input.status); }

    if (fields.length === 0) return this.findById(id, tenantId);

    fields.push(`updated_at = NOW()`);
    values.push(id, tenantId);

    const r = await this.db.query<OutboundRoute>(
      `UPDATE outbound_routes SET ${fields.join(', ')} WHERE id = $${idx} AND tenant_id = $${idx + 1} RETURNING ${COLUMNS}`,
      values,
    );
    return r.rows[0] ?? null;
  }

  async deactivate(id: string, tenantId: string): Promise<OutboundRoute | null> {
    const r = await this.db.query<OutboundRoute>(
      `UPDATE outbound_routes SET status = 'inactive', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2 RETURNING ${COLUMNS}`,
      [id, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async findActiveTrunk(tenantId: string, trunkId: string): Promise<{ id: string } | null> {
    const r = await this.db.query<{ id: string }>(
      `SELECT id FROM sip_trunks WHERE id = $1 AND tenant_id = $2 AND status = 'active'`,
      [trunkId, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async resolveRouteForNumber(tenantId: string, dialNumber: string): Promise<ResolvedOutboundRoute | null> {
    const r = await this.db.query<ResolvedOutboundRoute>(
      `SELECT id AS route_id, sip_trunk_id, fallback_sip_trunk_id, match_prefix, priority
       FROM outbound_routes
       WHERE tenant_id = $1
         AND status = 'active'
         AND $2 LIKE (match_prefix || '%')
       ORDER BY length(match_prefix) DESC, priority ASC
       LIMIT 1`,
      [tenantId, dialNumber],
    );
    return r.rows[0] ?? null;
  }
}
