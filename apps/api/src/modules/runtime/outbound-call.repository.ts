import type { Pool } from 'pg';
import type { OutboundCallRequest } from './outbound-call.types.js';

const COLUMNS = `id, tenant_id, extension_id, dial_number, route_id, sip_trunk_id, status, created_at, updated_at`;

export class OutboundCallRepository {
  constructor(private readonly db: Pool) {}

  async create(input: {
    tenant_id: string;
    extension_id: string;
    dial_number: string;
    route_id: string | null;
    sip_trunk_id: string | null;
  }): Promise<OutboundCallRequest> {
    const r = await this.db.query<OutboundCallRequest>(
      `INSERT INTO outbound_call_requests
         (tenant_id, extension_id, dial_number, route_id, sip_trunk_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${COLUMNS}`,
      [input.tenant_id, input.extension_id, input.dial_number, input.route_id, input.sip_trunk_id],
    );
    return r.rows[0]!;
  }

  async findById(id: string, tenantId: string): Promise<OutboundCallRequest | null> {
    const r = await this.db.query<OutboundCallRequest>(
      `SELECT ${COLUMNS} FROM outbound_call_requests WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async findPendingByTenant(tenantId: string, limit = 20): Promise<OutboundCallRequest[]> {
    const r = await this.db.query<OutboundCallRequest>(
      `SELECT ${COLUMNS} FROM outbound_call_requests
       WHERE tenant_id = $1 AND status = 'pending'
       ORDER BY created_at ASC
       LIMIT $2`,
      [tenantId, limit],
    );
    return r.rows;
  }

  async updateStatus(id: string, tenantId: string, status: 'dispatched' | 'failed'): Promise<OutboundCallRequest | null> {
    const r = await this.db.query<OutboundCallRequest>(
      `UPDATE outbound_call_requests
       SET status = $1, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3
       RETURNING ${COLUMNS}`,
      [status, id, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async findActiveExtension(tenantId: string, extensionId: string): Promise<{ id: string } | null> {
    const r = await this.db.query<{ id: string }>(
      `SELECT id FROM extensions WHERE id = $1 AND tenant_id = $2 AND status = 'active'`,
      [extensionId, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async resolveRouteForNumber(tenantId: string, dialNumber: string): Promise<{ route_id: string; sip_trunk_id: string } | null> {
    const r = await this.db.query<{ route_id: string; sip_trunk_id: string }>(
      `SELECT id AS route_id, sip_trunk_id
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

  async findActiveRouteById(tenantId: string, routeId: string): Promise<{ id: string; sip_trunk_id: string } | null> {
    const r = await this.db.query<{ id: string; sip_trunk_id: string }>(
      `SELECT id, sip_trunk_id FROM outbound_routes WHERE id = $1 AND tenant_id = $2 AND status = 'active'`,
      [routeId, tenantId],
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
}
