import type { Pool } from 'pg';
import type {
  DependentRouteRow,
  InboundRouteRow,
  OutboundRouteRow,
  RouteVersionRow,
  SipTrunkRow,
} from './risk-analysis.types.js';

export class RiskAnalysisRepository {
  constructor(private readonly db: Pool) {}

  async findOutboundRoute(id: string, tenantId: string): Promise<OutboundRouteRow | null> {
    const r = await this.db.query<OutboundRouteRow>(
      `SELECT id, name, status, match_prefix, priority, sip_trunk_id,
              fallback_sip_trunk_id, max_calls_per_minute
       FROM outbound_routes WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async findInboundRoute(id: string, tenantId: string): Promise<InboundRouteRow | null> {
    const r = await this.db.query<InboundRouteRow>(
      `SELECT id, name, status, match_type, match_value, phone_number_id,
              target_type, target_id, draft_version_id, active_version_id
       FROM inbound_routes WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async findRouteVersion(id: string): Promise<RouteVersionRow | null> {
    const r = await this.db.query<RouteVersionRow>(
      `SELECT id, state, version_number FROM route_versions WHERE id = $1`,
      [id],
    );
    return r.rows[0] ?? null;
  }

  async findSipTrunk(id: string, tenantId: string): Promise<SipTrunkRow | null> {
    const r = await this.db.query<SipTrunkRow>(
      `SELECT id, name, status, direction FROM sip_trunks WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async findTrunkById(trunkId: string, tenantId: string): Promise<{ id: string; name: string; status: string } | null> {
    const r = await this.db.query<{ id: string; name: string; status: string }>(
      `SELECT id, name, status FROM sip_trunks WHERE id = $1 AND tenant_id = $2`,
      [trunkId, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async countActiveOutboundRoutesForTrunk(trunkId: string, tenantId: string, excludeId: string): Promise<number> {
    const r = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM outbound_routes
       WHERE tenant_id = $1 AND status = 'active'
         AND (sip_trunk_id = $2 OR fallback_sip_trunk_id = $2)
         AND id != $3`,
      [tenantId, trunkId, excludeId],
    );
    return parseInt(r.rows[0]?.count ?? '0', 10);
  }

  async countActiveOutboundRoutesWithPrefix(prefix: string, tenantId: string, excludeId: string): Promise<number> {
    const r = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM outbound_routes
       WHERE tenant_id = $1 AND status = 'active'
         AND match_prefix = $2 AND id != $3`,
      [tenantId, prefix, excludeId],
    );
    return parseInt(r.rows[0]?.count ?? '0', 10);
  }

  async hasConflictingActiveInboundRoute(tenantId: string, matchType: string, matchValue: string, excludeId: string): Promise<boolean> {
    const r = await this.db.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM inbound_routes
         WHERE tenant_id = $1 AND status = 'active'
           AND match_type = $2 AND match_value = $3 AND id != $4
       ) AS exists`,
      [tenantId, matchType, matchValue, excludeId],
    );
    return r.rows[0]?.exists ?? false;
  }

  async findDependentOutboundRoutes(trunkId: string, tenantId: string): Promise<DependentRouteRow[]> {
    const r = await this.db.query<{ id: string; name: string; status: string; is_fallback: boolean }>(
      `SELECT id, name, status,
              (fallback_sip_trunk_id = $1) AS is_fallback
       FROM outbound_routes
       WHERE tenant_id = $2
         AND (sip_trunk_id = $1 OR fallback_sip_trunk_id = $1)
       ORDER BY status, name`,
      [trunkId, tenantId],
    );
    return r.rows.map(row => ({
      id: row.id,
      name: row.name,
      status: row.status,
      role: row.is_fallback ? 'fallback' : 'primary',
    }));
  }

  async hasPendingApplyRequest(trunkId: string, tenantId: string): Promise<boolean> {
    const r = await this.db.query<{ exists: boolean }>(
      `SELECT EXISTS(
         SELECT 1 FROM runtime_apply_requests
         WHERE tenant_id = $1 AND object_id = $2 AND status IN ('pending', 'in_progress')
       ) AS exists`,
      [tenantId, trunkId],
    );
    return r.rows[0]?.exists ?? false;
  }
}
