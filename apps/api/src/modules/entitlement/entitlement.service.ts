import type { EntitlementRepository } from './entitlement.repository.js';
import type { PlanName, ResolvedEntitlement, UsageStatus, TenantSubscription } from './entitlement.types.js';
import { EntitlementLimitExceededError } from './entitlement.types.js';

// Monthly-usage-based capability keys (use tenant_usage_counters, not table count)
const MONTHLY_COUNTER_KEYS = new Set([
  'call_events.monthly_limit',
  'ai.failure_explanation.monthly_limit',
  'ai.route_risk.monthly_limit',
  'ai.summary.monthly_limit',
  'ai.nl_report.monthly_limit',
  'migration.analysis.monthly_limit',
  'migration.draft_import.monthly_limit',
]);

export class EntitlementService {
  constructor(private readonly repo: EntitlementRepository) {}

  async getPlanForTenant(tenantId: string): Promise<TenantSubscription & { plan_name: PlanName }> {
    const sub = await this.repo.getSubscription(tenantId);
    if (sub) return sub as TenantSubscription & { plan_name: PlanName };
    const defaultPlan = await this.repo.getDefaultPlan();
    return {
      id: '',
      tenant_id: tenantId,
      plan_id: defaultPlan.id,
      plan_name: defaultPlan.name as PlanName,
      status: 'active',
      started_at: new Date(),
      expires_at: null,
    };
  }

  async getEntitlement(tenantId: string, capabilityKey: string): Promise<ResolvedEntitlement> {
    const plan = await this.getPlanForTenant(tenantId);
    const overrides = await this.repo.getActiveOverrides(tenantId);
    const override = overrides.find(o => o.capability_key === capabilityKey);

    if (override) {
      return {
        capability_key: capabilityKey,
        limit: override.integer_value,
        is_contract: override.string_value === 'contract',
        source: 'override',
      };
    }

    const entitlements = await this.repo.getPlanEntitlements(plan.plan_id);
    const planEnt = entitlements.find(e => e.capability_key === capabilityKey);
    return {
      capability_key: capabilityKey,
      limit: planEnt?.integer_value ?? null,
      is_contract: planEnt?.string_value === 'contract',
      source: 'plan',
    };
  }

  async getLimit(tenantId: string, capabilityKey: string): Promise<number | null> {
    const ent = await this.getEntitlement(tenantId, capabilityKey);
    return ent.limit;
  }

  async hasFeature(tenantId: string, capabilityKey: string): Promise<boolean> {
    const limit = await this.getLimit(tenantId, capabilityKey);
    return limit === null || limit > 0;
  }

  async assertFeature(tenantId: string, capabilityKey: string): Promise<void> {
    const has = await this.hasFeature(tenantId, capabilityKey);
    if (!has) {
      const plan = await this.getPlanForTenant(tenantId);
      throw new EntitlementLimitExceededError(capabilityKey, plan.plan_name, 0, 0);
    }
  }

  async assertWithinLimit(tenantId: string, capabilityKey: string, requestedIncrement = 1): Promise<void> {
    const ent = await this.getEntitlement(tenantId, capabilityKey);

    // Contract-defined enterprise limits: non-blocking unless specific integer override exists
    if (ent.is_contract && ent.limit === null) return;

    // No configured limit means unlimited
    if (ent.limit === null) return;

    let current: number;
    if (MONTHLY_COUNTER_KEYS.has(capabilityKey)) {
      current = await this.repo.getMonthlyUsage(tenantId, capabilityKey);
    } else {
      current = await this.repo.countResource(tenantId, capabilityKey);
    }

    if (current + requestedIncrement > ent.limit) {
      const plan = await this.getPlanForTenant(tenantId);
      throw new EntitlementLimitExceededError(capabilityKey, plan.plan_name, ent.limit, current);
    }
  }

  async recordUsage(tenantId: string, eventKey: string, quantity = 1, idempotencyKey?: string): Promise<void> {
    await this.repo.recordUsageEvent(tenantId, eventKey, quantity, idempotencyKey);
    if (MONTHLY_COUNTER_KEYS.has(eventKey)) {
      await this.repo.incrementUsageCounter(tenantId, eventKey, quantity);
    }
  }

  async getUsageStatus(tenantId: string, capabilityKey: string): Promise<UsageStatus> {
    const plan = await this.getPlanForTenant(tenantId);
    const ent = await this.getEntitlement(tenantId, capabilityKey);
    let current: number;
    if (MONTHLY_COUNTER_KEYS.has(capabilityKey)) {
      current = await this.repo.getMonthlyUsage(tenantId, capabilityKey);
    } else {
      current = await this.repo.countResource(tenantId, capabilityKey);
    }
    const limit = ent.limit;
    return {
      capability_key: capabilityKey,
      plan: plan.plan_name,
      limit,
      current,
      is_contract: ent.is_contract,
      warning_threshold_pct: 80,
      at_warning: limit !== null && current >= limit * 0.8,
      at_limit: limit !== null && current >= limit,
    };
  }

  async getAllUsageStatuses(tenantId: string): Promise<UsageStatus[]> {
    const plan = await this.getPlanForTenant(tenantId);
    const entitlements = await this.repo.getPlanEntitlements(plan.plan_id);
    const overrides = await this.repo.getActiveOverrides(tenantId);

    const keys = new Set([
      ...entitlements.map(e => e.capability_key),
      ...overrides.map(o => o.capability_key),
    ]);

    return Promise.all([...keys].map(key => this.getUsageStatus(tenantId, key)));
  }
}
