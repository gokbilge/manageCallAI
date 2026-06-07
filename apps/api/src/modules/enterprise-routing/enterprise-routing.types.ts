import type { CallingPolicy, CallingPolicyStatus } from '../calling-policies/calling-policy.types.js';
import type { CallType, NumberingPlanStatus, NumberingRule } from '../numbering-plans/numbering-plan.types.js';
import type { OutboundRoute } from '../outbound-routes/outbound-route.types.js';
import type { Schedule } from '../schedules/schedule.types.js';
import type { Site, SiteStatus } from '../sites/site.types.js';

export type EnterpriseConflictSeverity = 'info' | 'warning' | 'error';
export type EnterpriseConflictScope =
  | 'route'
  | 'site'
  | 'numbering_plan'
  | 'calling_policy'
  | 'schedule'
  | 'trunk_group'
  | 'failover';

export interface EnterpriseConflict {
  code: string;
  severity: EnterpriseConflictSeverity;
  scope: EnterpriseConflictScope;
  message: string;
}

export interface EnterpriseValidationReport {
  target_type: 'outbound_route';
  target_id: string;
  target_name: string;
  validation_status: 'passed' | 'failed';
  blocking_issues: EnterpriseConflict[];
  advisory_issues: EnterpriseConflict[];
  checked_at: string;
  summary: string;
}

export interface EnterpriseSimulationStep {
  category: 'site' | 'schedule' | 'numbering' | 'policy' | 'route' | 'failover';
  status: 'ok' | 'warning' | 'blocked';
  title: string;
  detail: string;
}

export interface EnterpriseSimulationReport {
  target_type: 'outbound_route';
  target_id: string;
  dial_string: string;
  site_id: string | null;
  site_name: string | null;
  schedule_id: string | null;
  schedule_name: string | null;
  call_type: CallType | null;
  matched_rule_name: string | null;
  policy_name: string | null;
  schedule_state: 'in_hours' | 'out_of_hours' | 'not_checked' | 'missing';
  outcome:
    | 'routed_primary'
    | 'routed_fallback'
    | 'blocked_by_policy'
    | 'out_of_hours'
    | 'no_available_trunks'
    | 'schedule_missing';
  selected_trunk_id: string | null;
  selected_trunk_name: string | null;
  steps: EnterpriseSimulationStep[];
  summary: string;
  is_advisory: true;
  simulated_at: string;
}

export interface OutboundRouteEnterpriseCheck {
  validation: EnterpriseValidationReport;
  simulation: EnterpriseSimulationReport;
}

export interface EnterpriseCheckInput {
  dial_string?: string;
  site_id?: string | null;
  schedule_id?: string | null;
  at?: string | null;
}

export type EnterpriseRoutingRouteRow = OutboundRoute;

export type EnterpriseRoutingSiteRow = Pick<Site,
  | 'id'
  | 'name'
  | 'status'
  | 'timezone'
  | 'default_calling_policy_id'
  | 'default_numbering_plan_id'
  | 'default_outbound_route_id'
>;

export interface EnterpriseRoutingPlanRow {
  id: string;
  name: string;
  status: NumberingPlanStatus;
}

export interface EnterpriseRoutingPolicyRow extends Pick<CallingPolicy,
  | 'id'
  | 'name'
  | 'allow_local'
  | 'allow_national'
  | 'allow_mobile'
  | 'allow_international'
  | 'allow_premium_rate'
  | 'allow_toll_free'
  | 'allow_special'
  | 'emergency_always_allowed'
  | 'exceptions'
> {
  status: CallingPolicyStatus;
}

export type EnterpriseRoutingScheduleRow = Pick<Schedule,
  | 'id'
  | 'name'
  | 'status'
  | 'timezone'
  | 'weekly_rules_json'
  | 'holiday_overrides_json'
>;

export interface EnterpriseRoutingTrunkRow {
  id: string;
  name: string;
  status: 'active' | 'inactive';
}

export interface EnterpriseRoutingTrunkGroupMembershipRow {
  trunk_id: string;
  trunk_group_id: string;
  trunk_group_name: string;
  trunk_group_status: SiteStatus | 'active' | 'inactive';
  priority: number;
}

export interface EnterpriseRoutingResolvedPlan {
  plan: EnterpriseRoutingPlanRow | null;
  rules: NumberingRule[];
  source: 'site_default' | 'tenant_assignment' | 'none';
}

export interface EnterpriseRoutingResolvedPolicy {
  policy: EnterpriseRoutingPolicyRow | null;
  source: 'site_default' | 'tenant_assignment' | 'none';
}
