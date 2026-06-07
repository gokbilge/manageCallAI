import { describe, it, expect, vi } from 'vitest';
import type { Pool } from 'pg';
import { NumberingPlanRepository } from './numbering-plan.repository.js';
import type { NumberingPlan, NumberingPlanAssignment, NumberingRule } from './numbering-plan.types.js';

const TENANT = 'tenant-1';
const PLAN_ID = 'plan-1';
const RULE_ID = 'rule-1';

const basePlan: NumberingPlan = {
  id: PLAN_ID, tenant_id: TENANT, name: 'Default', description: null,
  country_code: 'US', status: 'active', created_at: new Date(), updated_at: new Date(),
};

const baseRule: NumberingRule = {
  id: RULE_ID, tenant_id: TENANT, plan_id: PLAN_ID, name: 'Local',
  pattern: '^[2-9]\\d{9}$', call_type: 'national', priority: 100,
  description: null, created_at: new Date(),
};

const baseAssignment: NumberingPlanAssignment = {
  id: 'assign-1', tenant_id: TENANT, plan_id: PLAN_ID,
  assignable_type: 'tenant', assignable_id: null, created_at: new Date(),
};

function makePool(rows: unknown[] = []): Pool {
  return { query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }) } as unknown as Pool;
}

describe('NumberingPlanRepository', () => {
  it('create inserts plan and returns it', async () => {
    const pool = makePool([basePlan]);
    const repo = new NumberingPlanRepository(pool);
    const result = await repo.create(TENANT, { name: 'Default', description: 'desc', country_code: 'US' });
    expect(result.name).toBe('Default');
    expect(result.country_code).toBe('US');
  });

  it('findAll returns all plans for tenant', async () => {
    const pool = makePool([basePlan]);
    const repo = new NumberingPlanRepository(pool);
    const result = await repo.findAll(TENANT);
    expect(result).toHaveLength(1);
  });

  it('findById returns plan with rules when found', async () => {
    const pool = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [basePlan] })
        .mockResolvedValueOnce({ rows: [baseRule] }),
    } as unknown as Pool;
    const repo = new NumberingPlanRepository(pool);
    const result = await repo.findById(PLAN_ID, TENANT);
    expect(result?.id).toBe(PLAN_ID);
    expect(result?.rules).toHaveLength(1);
  });

  it('findById returns null when not found', async () => {
    const pool = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }),
    } as unknown as Pool;
    const repo = new NumberingPlanRepository(pool);
    expect(await repo.findById('missing', TENANT)).toBeNull();
  });

  it('update builds dynamic SET clause and returns updated plan', async () => {
    const updated = { ...basePlan, name: 'Updated', status: 'inactive' };
    const pool = makePool([updated]);
    const repo = new NumberingPlanRepository(pool);
    const result = await repo.update(PLAN_ID, TENANT, {
      name: 'Updated', description: 'New desc', country_code: 'CA', status: 'inactive',
    });
    expect(result?.name).toBe('Updated');
  });

  it('update returns null when plan not found', async () => {
    const pool = makePool([]);
    const repo = new NumberingPlanRepository(pool);
    expect(await repo.update('missing', TENANT, { name: 'X' })).toBeNull();
  });

  it('delete returns true when deleted', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }) } as unknown as Pool;
    expect(await new NumberingPlanRepository(pool).delete(PLAN_ID, TENANT)).toBe(true);
  });

  it('delete returns false when not found', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) } as unknown as Pool;
    expect(await new NumberingPlanRepository(pool).delete('missing', TENANT)).toBe(false);
  });

  it('createRule inserts rule and returns it', async () => {
    const pool = makePool([baseRule]);
    const repo = new NumberingPlanRepository(pool);
    const result = await repo.createRule(TENANT, PLAN_ID, {
      name: 'Local', pattern: '^\\d{10}$', call_type: 'national', priority: 100,
    });
    expect(result.pattern).toBe('^[2-9]\\d{9}$');
  });

  it('deleteRule returns true when deleted', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }) } as unknown as Pool;
    expect(await new NumberingPlanRepository(pool).deleteRule(RULE_ID, PLAN_ID, TENANT)).toBe(true);
  });

  it('deleteRule returns false when not found', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) } as unknown as Pool;
    expect(await new NumberingPlanRepository(pool).deleteRule('missing', PLAN_ID, TENANT)).toBe(false);
  });

  it('findRulesForPlan returns rules in priority order', async () => {
    const pool = makePool([baseRule]);
    const repo = new NumberingPlanRepository(pool);
    const result = await repo.findRulesForPlan(PLAN_ID, TENANT);
    expect(result).toHaveLength(1);
    expect(result[0]!.plan_id).toBe(PLAN_ID);
  });

  it('assign upserts assignment and returns it', async () => {
    const pool = makePool([baseAssignment]);
    const repo = new NumberingPlanRepository(pool);
    const result = await repo.assign(TENANT, PLAN_ID, 'tenant', null);
    expect(result.plan_id).toBe(PLAN_ID);
    expect(result.assignable_type).toBe('tenant');
  });

  it('assign accepts non-null assignable_id for extension scope', async () => {
    const assignment = { ...baseAssignment, assignable_type: 'extension' as const, assignable_id: 'ext-1' };
    const pool = makePool([assignment]);
    const repo = new NumberingPlanRepository(pool);
    const result = await repo.assign(TENANT, PLAN_ID, 'extension', 'ext-1');
    expect(result.assignable_id).toBe('ext-1');
  });

  it('findAssignment returns assignment when found', async () => {
    const pool = makePool([baseAssignment]);
    const repo = new NumberingPlanRepository(pool);
    const result = await repo.findAssignment(TENANT, 'tenant', null);
    expect(result?.plan_id).toBe(PLAN_ID);
  });

  it('findAssignment returns null when not found', async () => {
    const pool = makePool([]);
    const repo = new NumberingPlanRepository(pool);
    expect(await repo.findAssignment(TENANT, 'extension', 'ext-missing')).toBeNull();
  });

  it('findTenantRules returns rules for tenant plan assignment', async () => {
    const pool = makePool([baseRule]);
    const repo = new NumberingPlanRepository(pool);
    const result = await repo.findTenantRules(TENANT);
    expect(result).toHaveLength(1);
  });
});
