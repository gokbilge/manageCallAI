import type { Pool } from 'pg';
import type { NumberingRule } from '../numbering-plans/numbering-plan.types.js';
import type {
  EnterpriseRoutingPlanRow,
  EnterpriseRoutingPolicyRow,
  EnterpriseRoutingRouteRow,
  EnterpriseRoutingScheduleRow,
  EnterpriseRoutingSiteRow,
  EnterpriseRoutingTrunkGroupMembershipRow,
  EnterpriseRoutingTrunkRow,
} from './enterprise-routing.types.js';

const routeCols = `id, tenant_id, name, status, match_prefix, priority, sip_trunk_id,
  fallback_sip_trunk_id, max_calls_per_minute, allowed_caller_id_numbers_json,
  allowed_destination_prefixes_json, blocked_destination_prefixes_json, created_at, updated_at`;
const siteCols = `id, name, status, timezone, default_calling_policy_id,
  default_numbering_plan_id, default_outbound_route_id`;
const planCols = `id, name, status`;
const ruleCols = `id, tenant_id, plan_id, name, pattern, call_type, priority, description, created_at`;
const policyCols = `id, name, allow_local, allow_national, allow_mobile, allow_international,
  allow_premium_rate, allow_toll_free, allow_special, emergency_always_allowed, exceptions, status`;
const scheduleCols = `id, name, status, timezone, weekly_rules_json, holiday_overrides_json`;

export class EnterpriseRoutingRepository {
  constructor(private readonly db: Pool) {}

  async findOutboundRoute(id: string, tenantId: string): Promise<EnterpriseRoutingRouteRow | null> {
    const result = await this.db.query<EnterpriseRoutingRouteRow>(
      `SELECT ${routeCols} FROM outbound_routes WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async countActivePrefixConflicts(tenantId: string, matchPrefix: string, excludeId: string): Promise<number> {
    const result = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM outbound_routes
       WHERE tenant_id = $1 AND status = 'active' AND match_prefix = $2 AND id != $3`,
      [tenantId, matchPrefix, excludeId],
    );
    return Number.parseInt(result.rows[0]?.count ?? '0', 10);
  }

  async findTrunksByIds(tenantId: string, ids: string[]): Promise<Map<string, EnterpriseRoutingTrunkRow>> {
    if (ids.length === 0) {
      return new Map();
    }
    const result = await this.db.query<EnterpriseRoutingTrunkRow>(
      `SELECT id, name, status
       FROM sip_trunks
       WHERE tenant_id = $1 AND id = ANY($2)`,
      [tenantId, ids],
    );
    return new Map(result.rows.map((row) => [row.id, row]));
  }

  async findSitesReferencingRoute(tenantId: string, routeId: string): Promise<EnterpriseRoutingSiteRow[]> {
    const result = await this.db.query<EnterpriseRoutingSiteRow>(
      `SELECT ${siteCols}
       FROM sites
       WHERE tenant_id = $1 AND default_outbound_route_id = $2
       ORDER BY name`,
      [tenantId, routeId],
    );
    return result.rows;
  }

  async findSiteById(tenantId: string, siteId: string): Promise<EnterpriseRoutingSiteRow | null> {
    const result = await this.db.query<EnterpriseRoutingSiteRow>(
      `SELECT ${siteCols}
       FROM sites
       WHERE tenant_id = $1 AND id = $2`,
      [tenantId, siteId],
    );
    return result.rows[0] ?? null;
  }

  async findNumberingPlanById(tenantId: string, planId: string): Promise<EnterpriseRoutingPlanRow | null> {
    const result = await this.db.query<EnterpriseRoutingPlanRow>(
      `SELECT ${planCols}
       FROM numbering_plans
       WHERE tenant_id = $1 AND id = $2`,
      [tenantId, planId],
    );
    return result.rows[0] ?? null;
  }

  async findNumberingRulesForPlan(tenantId: string, planId: string): Promise<NumberingRule[]> {
    const result = await this.db.query<NumberingRule>(
      `SELECT ${ruleCols}
       FROM numbering_rules
       WHERE tenant_id = $1 AND plan_id = $2
       ORDER BY priority, name`,
      [tenantId, planId],
    );
    return result.rows;
  }

  async findTenantAssignedNumberingPlan(tenantId: string): Promise<EnterpriseRoutingPlanRow | null> {
    const result = await this.db.query<EnterpriseRoutingPlanRow>(
      `SELECT np.${planCols.split(',').map((column) => column.trim()).join(', np.')}
       FROM numbering_plans np
       JOIN numbering_plan_assignments npa ON npa.plan_id = np.id AND npa.tenant_id = np.tenant_id
       WHERE np.tenant_id = $1
         AND npa.assignable_type = 'tenant'
         AND npa.assignable_id IS NULL
       LIMIT 1`,
      [tenantId],
    );
    return result.rows[0] ?? null;
  }

  async findCallingPolicyById(tenantId: string, policyId: string): Promise<EnterpriseRoutingPolicyRow | null> {
    const result = await this.db.query<EnterpriseRoutingPolicyRow>(
      `SELECT ${policyCols}
       FROM calling_policies
       WHERE tenant_id = $1 AND id = $2`,
      [tenantId, policyId],
    );
    return result.rows[0] ?? null;
  }

  async findTenantAssignedCallingPolicy(tenantId: string): Promise<EnterpriseRoutingPolicyRow | null> {
    const result = await this.db.query<EnterpriseRoutingPolicyRow>(
      `SELECT cp.${policyCols.split(',').map((column) => column.trim()).join(', cp.')}
       FROM calling_policies cp
       JOIN calling_policy_assignments cpa ON cpa.policy_id = cp.id AND cpa.tenant_id = cp.tenant_id
       WHERE cp.tenant_id = $1
         AND cpa.assignable_type = 'tenant'
         AND cpa.assignable_id IS NULL
       LIMIT 1`,
      [tenantId],
    );
    return result.rows[0] ?? null;
  }

  async findScheduleById(tenantId: string, scheduleId: string): Promise<EnterpriseRoutingScheduleRow | null> {
    const result = await this.db.query<EnterpriseRoutingScheduleRow>(
      `SELECT ${scheduleCols}
       FROM schedules
       WHERE tenant_id = $1 AND id = $2`,
      [tenantId, scheduleId],
    );
    return result.rows[0] ?? null;
  }

  async findTrunkGroupMemberships(tenantId: string, trunkIds: string[]): Promise<EnterpriseRoutingTrunkGroupMembershipRow[]> {
    if (trunkIds.length === 0) {
      return [];
    }
    const result = await this.db.query<EnterpriseRoutingTrunkGroupMembershipRow>(
      `SELECT tgm.trunk_id,
              tg.id AS trunk_group_id,
              tg.name AS trunk_group_name,
              tg.status AS trunk_group_status,
              tgm.priority
       FROM trunk_group_members tgm
       JOIN trunk_groups tg ON tg.id = tgm.trunk_group_id AND tg.tenant_id = tgm.tenant_id
       WHERE tgm.tenant_id = $1 AND tgm.trunk_id = ANY($2)
       ORDER BY tg.name, tgm.priority`,
      [tenantId, trunkIds],
    );
    return result.rows;
  }
}
