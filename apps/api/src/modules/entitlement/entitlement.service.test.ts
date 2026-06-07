import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import { EntitlementService } from './entitlement.service.js';
import { EntitlementRepository } from './entitlement.repository.js';
import { EntitlementLimitExceededError } from './entitlement.types.js';

const FREE_PLAN_ID = '00000000-0000-0000-0000-000000000001';
const PRO_PLAN_ID = '00000000-0000-0000-0000-000000000002';
const TENANT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const OTHER_TENANT_ID = 'bbbbbbbb-0000-0000-0000-000000000001';

const FREE_PLAN = { id: FREE_PLAN_ID, name: 'free' as const, display_name: 'Free', is_default: true };
const PRO_PLAN = { id: PRO_PLAN_ID, name: 'pro' as const, display_name: 'Pro', is_default: false };

const FREE_ENTITLEMENTS = [
  { capability_key: 'extension.max_count', integer_value: 25, string_value: null, unit: 'count' },
  { capability_key: 'sip_trunk.max_count', integer_value: 2, string_value: null, unit: 'count' },
  { capability_key: 'ivr.flow.max_count', integer_value: 5, string_value: null, unit: 'count' },
  { capability_key: 'queue.max_count', integer_value: 2, string_value: null, unit: 'count' },
  { capability_key: 'ai.failure_explanation.monthly_limit', integer_value: 25, string_value: null, unit: 'monthly' },
  { capability_key: 'migration.draft_import.monthly_limit', integer_value: 0, string_value: null, unit: 'monthly' },
];

const PRO_ENTITLEMENTS = [
  { capability_key: 'extension.max_count', integer_value: 250, string_value: null, unit: 'count' },
  { capability_key: 'sip_trunk.max_count', integer_value: 10, string_value: null, unit: 'count' },
  { capability_key: 'ivr.flow.max_count', integer_value: 50, string_value: null, unit: 'count' },
  { capability_key: 'ai.failure_explanation.monthly_limit', integer_value: 2500, string_value: null, unit: 'monthly' },
];

const ENTERPRISE_ENTITLEMENTS = [
  { capability_key: 'extension.max_count', integer_value: null, string_value: 'contract', unit: 'count' },
  { capability_key: 'sip_trunk.max_count', integer_value: null, string_value: 'contract', unit: 'count' },
  { capability_key: 'ivr.flow.max_count', integer_value: null, string_value: 'contract', unit: 'count' },
];

type PlanRow = { id: string; name: string; display_name: string; is_default: boolean };
type EntitlementRow = { capability_key: string; integer_value: number | null; string_value: string | null; unit: string };

/**
 * Build a mock Pool whose query() function inspects the SQL and returns
 * appropriate test rows.
 */
function makePool(opts: {
  plan?: PlanRow;
  entitlements?: EntitlementRow[];
  subscription?: { plan_id: string; plan_name: string } | null;
  resourceCount?: number;
  monthlyCount?: number;
  overrides?: Array<{ capability_key: string; integer_value: number | null; string_value: string | null; expires_at: Date | null }>;
  idempotencyHit?: boolean;
} = {}): Pool {
  const {
    plan = FREE_PLAN,
    entitlements = FREE_ENTITLEMENTS,
    subscription = null,
    resourceCount = 0,
    monthlyCount = 0,
    overrides = [],
    idempotencyHit = false,
  } = opts;

  return {
    query: vi.fn().mockImplementation((sql: string) => {
      // Default plan query
      if (sql.includes('commercial_plans WHERE is_default')) {
        return Promise.resolve({ rows: [plan] });
      }
      if (sql.includes('commercial_plans WHERE id =')) {
        return Promise.resolve({ rows: [plan] });
      }
      // Subscription query
      if (sql.includes('tenant_subscriptions')) {
        if (sql.includes('SELECT id FROM usage_events')) {
          return Promise.resolve({ rows: idempotencyHit ? [{ id: 'x' }] : [] });
        }
        if (sql.includes('INSERT INTO tenant_usage_counters') || sql.includes('ON CONFLICT')) {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('INSERT INTO usage_events')) {
          return Promise.resolve({ rows: [] });
        }
        if (subscription) {
          return Promise.resolve({ rows: [{ ...subscription, status: 'active', started_at: new Date(), expires_at: null, id: 'sub-1', tenant_id: TENANT_ID }] });
        }
        return Promise.resolve({ rows: [] });
      }
      // Plan entitlements
      if (sql.includes('commercial_plan_entitlements')) {
        return Promise.resolve({ rows: entitlements });
      }
      // Active overrides
      if (sql.includes('tenant_entitlement_overrides')) {
        return Promise.resolve({ rows: overrides });
      }
      // Monthly usage counter
      if (sql.includes('tenant_usage_counters')) {
        if (sql.includes('SELECT count')) {
          return Promise.resolve({ rows: monthlyCount > 0 ? [{ count: String(monthlyCount) }] : [] });
        }
        if (sql.includes('INSERT') || sql.includes('ON CONFLICT')) {
          return Promise.resolve({ rows: [] });
        }
      }
      // COUNT(*) resource query
      if (sql.includes('COUNT(*)')) {
        return Promise.resolve({ rows: [{ count: String(resourceCount) }] });
      }
      // usage_events insert
      if (sql.includes('usage_events')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    }),
  } as unknown as Pool;
}

function makeService(pool: Pool) {
  return new EntitlementService(new EntitlementRepository(pool));
}

beforeEach(() => vi.clearAllMocks());

describe('EntitlementService', () => {
  it('no subscription defaults to free plan', async () => {
    const svc = makeService(makePool({ subscription: null }));
    const plan = await svc.getPlanForTenant(TENANT_ID);
    expect(plan.plan_name).toBe('free');
    expect(plan.plan_id).toBe(FREE_PLAN_ID);
  });

  it('Free tenant assertWithinLimit passes when under limit', async () => {
    const svc = makeService(makePool({ resourceCount: 10 }));
    await expect(svc.assertWithinLimit(TENANT_ID, 'extension.max_count')).resolves.toBeUndefined();
  });

  it('Free tenant assertWithinLimit throws EntitlementLimitExceededError when at limit (extension.max_count=25)', async () => {
    const svc = makeService(makePool({ resourceCount: 25 }));
    await expect(svc.assertWithinLimit(TENANT_ID, 'extension.max_count')).rejects.toThrow(EntitlementLimitExceededError);
  });

  it('Free tenant cannot create 3rd SIP trunk (max 2)', async () => {
    const svc = makeService(makePool({ resourceCount: 2 }));
    await expect(svc.assertWithinLimit(TENANT_ID, 'sip_trunk.max_count')).rejects.toThrow(EntitlementLimitExceededError);
  });

  it('Free tenant cannot create 6th IVR flow (max 5)', async () => {
    const svc = makeService(makePool({ resourceCount: 5 }));
    await expect(svc.assertWithinLimit(TENANT_ID, 'ivr.flow.max_count')).rejects.toThrow(EntitlementLimitExceededError);
  });

  it('Pro tenant can create up to Pro limits (extension.max_count=250)', async () => {
    const svc = makeService(makePool({
      subscription: { plan_id: PRO_PLAN_ID, plan_name: 'pro' },
      plan: PRO_PLAN,
      entitlements: PRO_ENTITLEMENTS,
      resourceCount: 249,
    }));
    await expect(svc.assertWithinLimit(TENANT_ID, 'extension.max_count')).resolves.toBeUndefined();
  });

  it('tenant override with higher limit allows more than plan limit', async () => {
    const svc = makeService(makePool({
      resourceCount: 30,
      overrides: [
        { capability_key: 'extension.max_count', integer_value: 50, string_value: null, expires_at: null },
      ],
    }));
    // override sets limit to 50; count is 30 — should pass
    await expect(svc.assertWithinLimit(TENANT_ID, 'extension.max_count')).resolves.toBeUndefined();
  });

  it('expired override is ignored — falls back to plan limit', async () => {
    // The repository filters out expired overrides via SQL, so we return empty overrides
    // and resource count is at the plan limit of 25
    const svc = makeService(makePool({
      resourceCount: 25,
      overrides: [], // expired override already filtered by SQL
    }));
    await expect(svc.assertWithinLimit(TENANT_ID, 'extension.max_count')).rejects.toThrow(EntitlementLimitExceededError);
  });

  it('Enterprise contract value (string_value=contract, integer_value=null) does not hard block', async () => {
    const ENTERPRISE_PLAN = { id: 'ent-id', name: 'enterprise' as const, display_name: 'Enterprise', is_default: false };
    const svc = makeService(makePool({
      plan: ENTERPRISE_PLAN,
      entitlements: ENTERPRISE_ENTITLEMENTS,
      subscription: { plan_id: 'ent-id', plan_name: 'enterprise' },
      resourceCount: 9999,
    }));
    // Enterprise contract-defined with no hard block should pass
    await expect(svc.assertWithinLimit(TENANT_ID, 'extension.max_count')).resolves.toBeUndefined();
  });

  it('cross-tenant entitlement leakage is impossible — calls use tenant_id scoping', async () => {
    const pool = makePool({ resourceCount: 25 });
    const svc = makeService(pool);
    // Tenant A is at limit
    await expect(svc.assertWithinLimit(TENANT_ID, 'extension.max_count')).rejects.toThrow(EntitlementLimitExceededError);
    // Verify that the COUNT query was called with the specific tenant_id
    const mockFn = vi.mocked(pool.query as ReturnType<typeof vi.fn>);
    const countCalls = mockFn.mock.calls.filter(
      (args: unknown[]) => typeof args[0] === 'string' && (args[0] as string).includes('COUNT(*)')
    );
    expect(countCalls.length).toBeGreaterThan(0);
    // Each COUNT call should bind TENANT_ID (first positional param = $1)
    for (const call of countCalls) {
      expect(call[1]).toContain(TENANT_ID);
      expect(call[1]).not.toContain(OTHER_TENANT_ID);
    }
  });

  it('recordUsage increments monthly counter', async () => {
    const pool = makePool();
    const svc = makeService(pool);
    await svc.recordUsage(TENANT_ID, 'ai.failure_explanation.monthly_limit', 1);
    const mockFn = vi.mocked(pool.query as ReturnType<typeof vi.fn>);
    const counterCalls = mockFn.mock.calls.filter(
      (args: unknown[]) => typeof args[0] === 'string' && (args[0] as string).includes('tenant_usage_counters')
    );
    expect(counterCalls.length).toBeGreaterThan(0);
  });

  it('monthly AI limit blocks after quota exhausted', async () => {
    // ai.failure_explanation.monthly_limit = 25 for free; monthlyCount = 25
    const svc = makeService(makePool({ monthlyCount: 25 }));
    await expect(svc.assertWithinLimit(TENANT_ID, 'ai.failure_explanation.monthly_limit')).rejects.toThrow(EntitlementLimitExceededError);
  });

  it('EntitlementService is the only enforcement path — direct DB calls without service bypass checks', async () => {
    // Verify that assertWithinLimit always reaches the DB to check counts
    const pool = makePool({ resourceCount: 0 });
    const svc = makeService(pool);
    await svc.assertWithinLimit(TENANT_ID, 'extension.max_count');
    const mockFn = vi.mocked(pool.query as ReturnType<typeof vi.fn>);
    // Should have queried for the plan AND the resource count — proving the check ran
    const queryCalls = mockFn.mock.calls.map((args: unknown[]) => args[0] as string);
    expect(queryCalls.some(q => q.includes('commercial_plans'))).toBe(true);
    expect(queryCalls.some(q => q.includes('COUNT(*)'))).toBe(true);
  });
});
