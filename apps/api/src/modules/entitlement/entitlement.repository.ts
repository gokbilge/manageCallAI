import { Pool } from 'pg';
import type { CommercialPlan, PlanEntitlement, TenantSubscription, EntitlementOverride } from './entitlement.types.js';

// Resource table mapping for object-count limits
const RESOURCE_TABLE: Record<string, string> = {
  'extension.max_count': 'extensions',
  'device.max_count': 'devices',
  'sip_trunk.max_count': 'sip_trunks',
  'did.max_count': 'phone_numbers',
  'route.inbound.max_count': 'inbound_routes',
  'route.outbound.max_count': 'outbound_routes',
  'ivr.flow.max_count': 'ivr_flows',
  'queue.max_count': 'queues',
  'ring_group.max_count': 'call_groups',
  'voicemail_box.max_count': 'voicemail_boxes',
  'conference_room.max_count': 'conference_rooms',
  'parking_lot.max_count': 'parking_lots',
  'schedule.max_count': 'schedules',
  'feature_code.max_count': 'feature_codes',
  'api_key.max_count': 'automation_api_keys',
  'webhook.max_count': 'automation_webhooks',
};

export class EntitlementRepository {
  constructor(private readonly db: Pool) {}

  async getDefaultPlan(): Promise<CommercialPlan> {
    const { rows } = await this.db.query<CommercialPlan>(
      `SELECT id, name, display_name, is_default FROM commercial_plans WHERE is_default = true LIMIT 1`
    );
    if (!rows[0]) throw new Error('No default commercial plan found');
    return rows[0];
  }

  async getPlanById(planId: string): Promise<CommercialPlan | null> {
    const { rows } = await this.db.query<CommercialPlan>(
      `SELECT id, name, display_name, is_default FROM commercial_plans WHERE id = $1`, [planId]
    );
    return rows[0] ?? null;
  }

  async getPlanByName(name: string): Promise<CommercialPlan | null> {
    const { rows } = await this.db.query<CommercialPlan>(
      `SELECT id, name, display_name, is_default FROM commercial_plans WHERE name = $1`, [name]
    );
    return rows[0] ?? null;
  }

  async getAllPlans(): Promise<CommercialPlan[]> {
    const { rows } = await this.db.query<CommercialPlan>(
      `SELECT id, name, display_name, is_default FROM commercial_plans ORDER BY name`
    );
    return rows;
  }

  async getSubscription(tenantId: string): Promise<TenantSubscription | null> {
    const { rows } = await this.db.query<TenantSubscription & { plan_name: string }>(
      `SELECT ts.id, ts.tenant_id, ts.plan_id, cp.name AS plan_name, ts.status, ts.started_at, ts.expires_at
       FROM tenant_subscriptions ts
       JOIN commercial_plans cp ON cp.id = ts.plan_id
       WHERE ts.tenant_id = $1`, [tenantId]
    );
    return rows[0] ?? null;
  }

  async getPlanEntitlements(planId: string): Promise<PlanEntitlement[]> {
    const { rows } = await this.db.query<PlanEntitlement>(
      `SELECT capability_key, integer_value, string_value, unit
       FROM commercial_plan_entitlements WHERE plan_id = $1`, [planId]
    );
    return rows;
  }

  async getActiveOverrides(tenantId: string): Promise<EntitlementOverride[]> {
    const { rows } = await this.db.query<EntitlementOverride>(
      `SELECT capability_key, integer_value, string_value, expires_at
       FROM tenant_entitlement_overrides
       WHERE tenant_id = $1
         AND (expires_at IS NULL OR expires_at > NOW())`, [tenantId]
    );
    return rows;
  }

  async countResource(tenantId: string, capabilityKey: string): Promise<number> {
    const table = RESOURCE_TABLE[capabilityKey];
    if (!table) return 0;
    const { rows } = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM ${table} WHERE tenant_id = $1`, [tenantId]
    );
    return parseInt(rows[0]?.count ?? '0', 10);
  }

  async getMonthlyUsage(tenantId: string, counterKey: string): Promise<number> {
    const periodStart = new Date();
    periodStart.setDate(1);
    const period = periodStart.toISOString().slice(0, 10);
    const { rows } = await this.db.query<{ count: string }>(
      `SELECT count FROM tenant_usage_counters
       WHERE tenant_id = $1 AND counter_key = $2 AND period_start = $3`, [tenantId, counterKey, period]
    );
    return parseInt(rows[0]?.count ?? '0', 10);
  }

  async incrementUsageCounter(tenantId: string, counterKey: string, quantity: number): Promise<void> {
    const periodStart = new Date();
    periodStart.setDate(1);
    const period = periodStart.toISOString().slice(0, 10);
    await this.db.query(
      `INSERT INTO tenant_usage_counters (tenant_id, counter_key, period_start, count)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, counter_key, period_start)
       DO UPDATE SET count = tenant_usage_counters.count + $4, updated_at = NOW()`,
      [tenantId, counterKey, period, quantity]
    );
  }

  async recordUsageEvent(tenantId: string, eventKey: string, quantity: number, idempotencyKey?: string): Promise<void> {
    if (idempotencyKey) {
      const { rows } = await this.db.query(
        `SELECT id FROM usage_events WHERE tenant_id = $1 AND event_key = $2 AND idempotency_key = $3 LIMIT 1`,
        [tenantId, eventKey, idempotencyKey]
      );
      if (rows[0]) return; // already recorded
    }
    await this.db.query(
      `INSERT INTO usage_events (tenant_id, event_key, quantity, idempotency_key) VALUES ($1, $2, $3, $4)`,
      [tenantId, eventKey, quantity, idempotencyKey ?? null]
    );
  }
}
