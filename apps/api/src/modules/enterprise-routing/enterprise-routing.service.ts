import type { CallType, NumberingRule } from '../numbering-plans/numbering-plan.types.js';
import { isInBusinessHours } from '../schedules/schedule.util.js';
import type {
  EnterpriseCheckInput,
  EnterpriseConflict,
  EnterpriseRoutingPolicyRow,
  EnterpriseRoutingResolvedPlan,
  EnterpriseRoutingResolvedPolicy,
  EnterpriseRoutingScheduleRow,
  EnterpriseRoutingSiteRow,
  EnterpriseSimulationReport,
  EnterpriseSimulationStep,
  EnterpriseValidationReport,
  OutboundRouteEnterpriseCheck,
} from './enterprise-routing.types.js';
import type { EnterpriseRoutingRepository } from './enterprise-routing.repository.js';

export class EnterpriseRoutingTargetNotFoundError extends Error {
  constructor(routeId: string) {
    super(`Outbound route not found for enterprise check: ${routeId}`);
    this.name = 'EnterpriseRoutingTargetNotFoundError';
  }
}

function buildSampleDialString(matchPrefix: string): string {
  if (matchPrefix === '+') {
    return '+15551212';
  }
  return `${matchPrefix}5551212`;
}

function matchesRule(dialString: string, pattern: string): boolean {
  try {
    return new RegExp(pattern).test(dialString);
  } catch {
    return false;
  }
}

function classifyDial(rules: NumberingRule[], dialString: string): NumberingRule | null {
  const sorted = [...rules].sort((left, right) => left.priority - right.priority);
  for (const rule of sorted) {
    if (matchesRule(dialString, rule.pattern)) {
      return rule;
    }
  }
  return null;
}

function resolvePolicyDecision(policy: EnterpriseRoutingPolicyRow, callType: CallType, dialString: string): boolean {
  const exception = policy.exceptions.find((item) => dialString.startsWith(item.prefix));
  if (exception) {
    return exception.type === 'allow';
  }

  if (callType === 'emergency') {
    return policy.emergency_always_allowed;
  }

  const fieldByType: Record<CallType, boolean> = {
    local: policy.allow_local,
    national: policy.allow_national,
    mobile: policy.allow_mobile,
    international: policy.allow_international,
    premium_rate: policy.allow_premium_rate,
    emergency: policy.emergency_always_allowed,
    toll_free: policy.allow_toll_free,
    special: policy.allow_special,
  };

  return fieldByType[callType];
}

function summarizeValidation(
  routeName: string,
  blockingIssues: EnterpriseConflict[],
  advisoryIssues: EnterpriseConflict[],
): string {
  if (blockingIssues.length > 0) {
    return `Route "${routeName}" has ${blockingIssues.length} blocking enterprise conflict(s) and cannot be published until they are resolved.`;
  }
  if (advisoryIssues.length > 0) {
    return `Route "${routeName}" passed blocking validation with ${advisoryIssues.length} advisory enterprise concern(s).`;
  }
  return `Route "${routeName}" passed enterprise validation with no cross-object conflicts.`;
}

export class EnterpriseRoutingService {
  constructor(private readonly repo: EnterpriseRoutingRepository) {}

  async validateOutboundRoute(routeId: string, tenantId: string): Promise<EnterpriseValidationReport> {
    const route = await this.repo.findOutboundRoute(routeId, tenantId);
    if (!route) {
      throw new EnterpriseRoutingTargetNotFoundError(routeId);
    }

    const blockingIssues: EnterpriseConflict[] = [];
    const advisoryIssues: EnterpriseConflict[] = [];
    const trunkIds = [route.sip_trunk_id, route.fallback_sip_trunk_id].filter((value): value is string => Boolean(value));
    const [trunks, sites, prefixConflictCount, trunkGroupMemberships] = await Promise.all([
      this.repo.findTrunksByIds(tenantId, trunkIds),
      this.repo.findSitesReferencingRoute(tenantId, route.id),
      this.repo.countActivePrefixConflicts(tenantId, route.match_prefix, route.id),
      this.repo.findTrunkGroupMemberships(tenantId, trunkIds),
    ]);

    const primaryTrunk = trunks.get(route.sip_trunk_id) ?? null;
    if (!primaryTrunk) {
      blockingIssues.push({
        code: 'PRIMARY_TRUNK_MISSING',
        severity: 'error',
        scope: 'route',
        message: `Primary trunk ${route.sip_trunk_id} is missing.`,
      });
    } else if (primaryTrunk.status !== 'active') {
      blockingIssues.push({
        code: 'PRIMARY_TRUNK_INACTIVE',
        severity: 'error',
        scope: 'route',
        message: `Primary trunk "${primaryTrunk.name}" is ${primaryTrunk.status}.`,
      });
    }

    if (route.fallback_sip_trunk_id) {
      const fallbackTrunk = trunks.get(route.fallback_sip_trunk_id) ?? null;
      if (!fallbackTrunk) {
        advisoryIssues.push({
          code: 'FALLBACK_TRUNK_MISSING',
          severity: 'warning',
          scope: 'failover',
          message: `Fallback trunk ${route.fallback_sip_trunk_id} is missing.`,
        });
      } else if (fallbackTrunk.status !== 'active') {
        advisoryIssues.push({
          code: 'FALLBACK_TRUNK_INACTIVE',
          severity: 'warning',
          scope: 'failover',
          message: `Fallback trunk "${fallbackTrunk.name}" is ${fallbackTrunk.status}.`,
        });
      }
    }

    if (prefixConflictCount > 0) {
      blockingIssues.push({
        code: 'ACTIVE_PREFIX_CONFLICT',
        severity: 'error',
        scope: 'route',
        message: `${prefixConflictCount} active route(s) already use prefix "${route.match_prefix}".`,
      });
    }

    const activeMemberships = trunkGroupMemberships.filter((membership) => membership.trunk_group_status === 'active');
    const sharedGroups = new Map<string, string[]>();
    for (const membership of activeMemberships) {
      const entry = sharedGroups.get(membership.trunk_group_id) ?? [];
      entry.push(membership.trunk_id);
      sharedGroups.set(membership.trunk_group_id, entry);
    }
    for (const [groupId, groupTrunks] of sharedGroups) {
      if (groupTrunks.length > 1) {
        const groupName = activeMemberships.find((membership) => membership.trunk_group_id === groupId)?.trunk_group_name ?? groupId;
        advisoryIssues.push({
          code: 'FAILOVER_SHARED_TRUNK_GROUP',
          severity: 'warning',
          scope: 'trunk_group',
          message: `Primary and fallback trunks participate in active trunk group "${groupName}", which can hide failover intent.`,
        });
      }
    }

    const sampleDialString = buildSampleDialString(route.match_prefix);
    for (const site of sites.filter((item) => item.status === 'active')) {
      const resolvedPlan = await this.resolvePlanForSite(site, tenantId);
      const resolvedPolicy = await this.resolvePolicyForSite(site, tenantId);

      if (!resolvedPlan.plan) {
        advisoryIssues.push({
          code: 'SITE_NO_NUMBERING_PLAN',
          severity: 'warning',
          scope: 'numbering_plan',
          message: `Site "${site.name}" has no active numbering plan context for route prefix "${route.match_prefix}".`,
        });
      }

      if (!resolvedPolicy.policy) {
        advisoryIssues.push({
          code: 'SITE_NO_CALLING_POLICY',
          severity: 'warning',
          scope: 'calling_policy',
          message: `Site "${site.name}" has no active calling policy context. Policy conflicts cannot be proven before publish.`,
        });
      }

      if (resolvedPlan.plan && resolvedPolicy.policy) {
        const matchedRule = classifyDial(resolvedPlan.rules, sampleDialString);
        if (!matchedRule) {
          advisoryIssues.push({
            code: 'NUMBERING_RULE_UNMATCHED',
            severity: 'warning',
            scope: 'numbering_plan',
            message: `Site "${site.name}" numbering plan "${resolvedPlan.plan.name}" does not classify sample dial string "${sampleDialString}".`,
          });
        } else if (!resolvePolicyDecision(resolvedPolicy.policy, matchedRule.call_type as CallType, sampleDialString)) {
          blockingIssues.push({
            code: 'SITE_POLICY_BLOCKS_ROUTE',
            severity: 'error',
            scope: 'calling_policy',
            message: `Site "${site.name}" policy "${resolvedPolicy.policy.name}" blocks ${matchedRule.call_type} calls for prefix "${route.match_prefix}".`,
          });
        }
      }
    }

    return {
      target_type: 'outbound_route',
      target_id: route.id,
      target_name: route.name,
      validation_status: blockingIssues.length > 0 ? 'failed' : 'passed',
      blocking_issues: blockingIssues,
      advisory_issues: advisoryIssues,
      checked_at: new Date().toISOString(),
      summary: summarizeValidation(route.name, blockingIssues, advisoryIssues),
    };
  }

  async runOutboundRouteCheck(routeId: string, tenantId: string, input: EnterpriseCheckInput): Promise<OutboundRouteEnterpriseCheck> {
    const route = await this.repo.findOutboundRoute(routeId, tenantId);
    if (!route) {
      throw new EnterpriseRoutingTargetNotFoundError(routeId);
    }

    const validation = await this.validateOutboundRoute(routeId, tenantId);
    const simulation = await this.simulateOutboundRoute(route.id, tenantId, input);
    return { validation, simulation };
  }

  async simulateOutboundRoute(routeId: string, tenantId: string, input: EnterpriseCheckInput): Promise<EnterpriseSimulationReport> {
    const route = await this.repo.findOutboundRoute(routeId, tenantId);
    if (!route) {
      throw new EnterpriseRoutingTargetNotFoundError(routeId);
    }

    const dialString = input.dial_string?.trim() || buildSampleDialString(route.match_prefix);
    const steps: EnterpriseSimulationStep[] = [];
    const site = input.site_id ? await this.repo.findSiteById(tenantId, input.site_id) : null;
    const schedule = input.schedule_id ? await this.repo.findScheduleById(tenantId, input.schedule_id) : null;
    const at = input.at ? new Date(input.at) : new Date();
    const trunkIds = [route.sip_trunk_id, route.fallback_sip_trunk_id].filter((value): value is string => Boolean(value));
    const [trunks, memberships] = await Promise.all([
      this.repo.findTrunksByIds(tenantId, trunkIds),
      this.repo.findTrunkGroupMemberships(tenantId, trunkIds),
    ]);

    if (site) {
      const siteMessage = site.default_outbound_route_id && site.default_outbound_route_id !== route.id
        ? `Site "${site.name}" defaults to a different outbound route, so this simulation is forced onto "${route.name}".`
        : `Site "${site.name}" provides numbering and policy defaults for this simulation.`;
      steps.push({
        category: 'site',
        status: site.default_outbound_route_id && site.default_outbound_route_id !== route.id ? 'warning' : 'ok',
        title: 'Site context',
        detail: siteMessage,
      });
    } else {
      steps.push({
        category: 'site',
        status: 'warning',
        title: 'Site context',
        detail: 'No site selected. Tenant-wide defaults will be used when available.',
      });
    }

    let scheduleState: EnterpriseSimulationReport['schedule_state'] = 'not_checked';
    if (input.schedule_id) {
      if (!schedule) {
        steps.push({
          category: 'schedule',
          status: 'blocked',
          title: 'Schedule context',
          detail: `Schedule ${input.schedule_id} was not found.`,
        });
        return this.buildSimulationResult(route.id, dialString, site, null, null, null, 'missing', 'schedule_missing', null, null, steps, `Schedule ${input.schedule_id} was not found.`, at);
      }

      if (schedule.status !== 'active') {
        steps.push({
          category: 'schedule',
          status: 'blocked',
          title: 'Schedule context',
          detail: `Schedule "${schedule.name}" is ${schedule.status}.`,
        });
        return this.buildSimulationResult(route.id, dialString, site, schedule, null, null, 'missing', 'schedule_missing', null, null, steps, `Schedule "${schedule.name}" is ${schedule.status}.`, at);
      }

      const inHours = isInBusinessHours(schedule, at);
      scheduleState = inHours ? 'in_hours' : 'out_of_hours';
      steps.push({
        category: 'schedule',
        status: inHours ? 'ok' : 'blocked',
        title: 'Schedule context',
        detail: inHours
          ? `Schedule "${schedule.name}" is open at ${at.toISOString()}.`
          : `Schedule "${schedule.name}" is closed at ${at.toISOString()}.`,
      });

      if (!inHours) {
        return this.buildSimulationResult(route.id, dialString, site, schedule, null, null, scheduleState, 'out_of_hours', null, null, steps, `Route "${route.name}" would not be used because schedule "${schedule.name}" is closed.`, at);
      }
    }

    const resolvedPlan = await this.resolvePlanForSite(site, tenantId);
    const matchedRule = resolvedPlan.plan ? classifyDial(resolvedPlan.rules, dialString) : null;
    if (resolvedPlan.plan && matchedRule) {
      steps.push({
        category: 'numbering',
        status: 'ok',
        title: 'Numbering plan',
        detail: `Dial string "${dialString}" matches numbering rule "${matchedRule.name}" as ${matchedRule.call_type}.`,
      });
    } else if (resolvedPlan.plan) {
      steps.push({
        category: 'numbering',
        status: 'warning',
        title: 'Numbering plan',
        detail: `Dial string "${dialString}" did not match any numbering rule in "${resolvedPlan.plan.name}".`,
      });
    } else {
      steps.push({
        category: 'numbering',
        status: 'warning',
        title: 'Numbering plan',
        detail: 'No active numbering plan was available for this simulation.',
      });
    }

    const resolvedPolicy = await this.resolvePolicyForSite(site, tenantId);
    if (resolvedPolicy.policy && matchedRule) {
      const allowed = resolvePolicyDecision(resolvedPolicy.policy, matchedRule.call_type as CallType, dialString);
      steps.push({
        category: 'policy',
        status: allowed ? 'ok' : 'blocked',
        title: 'Calling policy',
        detail: allowed
          ? `Policy "${resolvedPolicy.policy.name}" permits ${matchedRule.call_type} calls for "${dialString}".`
          : `Policy "${resolvedPolicy.policy.name}" blocks ${matchedRule.call_type} calls for "${dialString}".`,
      });

      if (!allowed) {
        return this.buildSimulationResult(route.id, dialString, site, schedule ?? null, matchedRule.call_type as CallType, matchedRule.name, scheduleState, 'blocked_by_policy', null, null, steps, `Route "${route.name}" would be blocked by policy "${resolvedPolicy.policy.name}".`, at);
      }
    } else if (!resolvedPolicy.policy) {
      steps.push({
        category: 'policy',
        status: 'warning',
        title: 'Calling policy',
        detail: 'No active calling policy was available for this simulation.',
      });
    }

    steps.push({
      category: 'route',
      status: 'ok',
      title: 'Route selection',
      detail: `Route "${route.name}" matches dial prefix "${route.match_prefix}" with priority ${route.priority}.`,
    });

    const primaryTrunk = trunks.get(route.sip_trunk_id) ?? null;
    const fallbackTrunk = route.fallback_sip_trunk_id ? trunks.get(route.fallback_sip_trunk_id) ?? null : null;
    const activeMemberships = memberships.filter((membership) => membership.trunk_group_status === 'active');
    if (activeMemberships.length > 0) {
      const names = [...new Set(activeMemberships.map((membership) => membership.trunk_group_name))];
      steps.push({
        category: 'failover',
        status: names.length > 1 ? 'warning' : 'ok',
        title: 'Trunk-group context',
        detail: `Selected trunks participate in active group(s): ${names.join(', ')}.`,
      });
    }

    if (primaryTrunk?.status === 'active') {
      steps.push({
        category: 'failover',
        status: 'ok',
        title: 'Failover decision',
        detail: `Primary trunk "${primaryTrunk.name}" is active and would carry the call.`,
      });
      return this.buildSimulationResult(route.id, dialString, site, schedule ?? null, matchedRule?.call_type as CallType | null ?? null, matchedRule?.name ?? null, scheduleState, 'routed_primary', primaryTrunk.id, primaryTrunk.name, steps, `Route "${route.name}" would route through primary trunk "${primaryTrunk.name}".`, at);
    }

    if (fallbackTrunk?.status === 'active') {
      steps.push({
        category: 'failover',
        status: 'warning',
        title: 'Failover decision',
        detail: primaryTrunk
          ? `Primary trunk "${primaryTrunk.name}" is ${primaryTrunk.status}; fallback trunk "${fallbackTrunk.name}" would carry the call.`
          : `Fallback trunk "${fallbackTrunk.name}" would carry the call because the primary trunk is unavailable.`,
      });
      return this.buildSimulationResult(route.id, dialString, site, schedule ?? null, matchedRule?.call_type as CallType | null ?? null, matchedRule?.name ?? null, scheduleState, 'routed_fallback', fallbackTrunk.id, fallbackTrunk.name, steps, `Route "${route.name}" would fail over to "${fallbackTrunk.name}".`, at);
    }

    steps.push({
      category: 'failover',
      status: 'blocked',
      title: 'Failover decision',
      detail: 'Neither the primary trunk nor the fallback trunk is currently active.',
    });

    return this.buildSimulationResult(route.id, dialString, site, schedule ?? null, matchedRule?.call_type as CallType | null ?? null, matchedRule?.name ?? null, scheduleState, 'no_available_trunks', null, null, steps, `Route "${route.name}" has no available trunks for this simulation.`, at);
  }

  private buildSimulationResult(
    routeId: string,
    dialString: string,
    site: EnterpriseRoutingSiteRow | null,
    schedule: EnterpriseRoutingScheduleRow | null,
    callType: CallType | null,
    matchedRuleName: string | null,
    scheduleState: EnterpriseSimulationReport['schedule_state'],
    outcome: EnterpriseSimulationReport['outcome'],
    selectedTrunkId: string | null,
    selectedTrunkName: string | null,
    steps: EnterpriseSimulationStep[],
    summary: string,
    at: Date,
  ): EnterpriseSimulationReport {
    return {
      target_type: 'outbound_route',
      target_id: routeId,
      dial_string: dialString,
      site_id: site?.id ?? null,
      site_name: site?.name ?? null,
      schedule_id: schedule?.id ?? null,
      schedule_name: schedule?.name ?? null,
      call_type: callType,
      matched_rule_name: matchedRuleName,
      policy_name: null,
      schedule_state: scheduleState,
      outcome,
      selected_trunk_id: selectedTrunkId,
      selected_trunk_name: selectedTrunkName,
      steps,
      summary,
      is_advisory: true,
      simulated_at: at.toISOString(),
    };
  }

  private async resolvePlanForSite(site: EnterpriseRoutingSiteRow | null, tenantId: string): Promise<EnterpriseRoutingResolvedPlan> {
    if (site?.default_numbering_plan_id) {
      const plan = await this.repo.findNumberingPlanById(tenantId, site.default_numbering_plan_id);
      if (plan?.status === 'active') {
        return {
          plan,
          rules: await this.repo.findNumberingRulesForPlan(tenantId, plan.id),
          source: 'site_default',
        };
      }
      return { plan: null, rules: [], source: 'site_default' };
    }

    const tenantPlan = await this.repo.findTenantAssignedNumberingPlan(tenantId);
    if (!tenantPlan || tenantPlan.status !== 'active') {
      return { plan: null, rules: [], source: tenantPlan ? 'tenant_assignment' : 'none' };
    }

    return {
      plan: tenantPlan,
      rules: await this.repo.findNumberingRulesForPlan(tenantId, tenantPlan.id),
      source: 'tenant_assignment',
    };
  }

  private async resolvePolicyForSite(site: EnterpriseRoutingSiteRow | null, tenantId: string): Promise<EnterpriseRoutingResolvedPolicy> {
    if (site?.default_calling_policy_id) {
      const policy = await this.repo.findCallingPolicyById(tenantId, site.default_calling_policy_id);
      return { policy: policy?.status === 'active' ? policy : null, source: 'site_default' };
    }

    const tenantPolicy = await this.repo.findTenantAssignedCallingPolicy(tenantId);
    return { policy: tenantPolicy?.status === 'active' ? tenantPolicy : null, source: tenantPolicy ? 'tenant_assignment' : 'none' };
  }
}
