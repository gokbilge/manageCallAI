import { describe, expect, it, vi } from 'vitest';
import type { NumberingPlanRepository } from './numbering-plan.repository.js';
import {
  NumberingPlanService,
  NumberingPlanNotFoundError,
  NumberingRuleNotFoundError,
} from './numbering-plan.service.js';
import type { NumberingPlan, NumberingRule, NumberingPlanWithRules } from './numbering-plan.types.js';

const TENANT = 'tenant-1';
const PLAN_ID = 'plan-1';

const plan: NumberingPlan = {
  id: PLAN_ID, tenant_id: TENANT, name: 'NANP', description: null,
  country_code: '1', status: 'active', created_at: new Date(), updated_at: new Date(),
};

const rule: NumberingRule = {
  id: 'rule-1', tenant_id: TENANT, plan_id: PLAN_ID, name: 'International',
  pattern: '^\\+(?!1)', call_type: 'international', priority: 10, description: null, created_at: new Date(),
};

const planWithRules: NumberingPlanWithRules = { ...plan, rules: [rule] };

function makeRepo(overrides: Partial<NumberingPlanRepository> = {}): NumberingPlanRepository {
  return {
    create: vi.fn().mockResolvedValue(plan),
    findAll: vi.fn().mockResolvedValue([plan]),
    findById: vi.fn().mockResolvedValue(planWithRules),
    update: vi.fn().mockResolvedValue({ ...plan, name: 'Updated' }),
    delete: vi.fn().mockResolvedValue(true),
    createRule: vi.fn().mockResolvedValue(rule),
    deleteRule: vi.fn().mockResolvedValue(true),
    findRulesForPlan: vi.fn().mockResolvedValue([rule]),
    assign: vi.fn().mockResolvedValue({ id: 'assign-1', tenant_id: TENANT, plan_id: PLAN_ID, assignable_type: 'tenant', assignable_id: null, created_at: new Date() }),
    findAssignment: vi.fn().mockResolvedValue(null),
    findTenantRules: vi.fn().mockResolvedValue([rule]),
    ...overrides,
  } as unknown as NumberingPlanRepository;
}

describe('NumberingPlanService', () => {
  it('creates a numbering plan', async () => {
    const svc = new NumberingPlanService(makeRepo());
    const result = await svc.create(TENANT, { name: 'NANP', country_code: '1' });
    expect(result.name).toBe('NANP');
  });

  it('lists numbering plans', async () => {
    const svc = new NumberingPlanService(makeRepo());
    expect(await svc.list(TENANT)).toHaveLength(1);
  });

  it('gets plan by id with rules', async () => {
    const svc = new NumberingPlanService(makeRepo());
    const result = await svc.getById(PLAN_ID, TENANT);
    expect(result.rules).toHaveLength(1);
    expect(result.rules[0]!.call_type).toBe('international');
  });

  it('throws NumberingPlanNotFoundError when plan missing', async () => {
    const svc = new NumberingPlanService(makeRepo({ findById: vi.fn().mockResolvedValue(null) }));
    await expect(svc.getById('missing', TENANT)).rejects.toBeInstanceOf(NumberingPlanNotFoundError);
  });

  it('adds a numbering rule to a plan', async () => {
    const svc = new NumberingPlanService(makeRepo());
    const result = await svc.addRule(PLAN_ID, TENANT, { name: 'Intl', pattern: '^\\+', call_type: 'international' });
    expect(result.call_type).toBe('international');
  });

  it('throws when removing a non-existent rule', async () => {
    const svc = new NumberingPlanService(makeRepo({ deleteRule: vi.fn().mockResolvedValue(false) }));
    await expect(svc.removeRule('missing', PLAN_ID, TENANT)).rejects.toBeInstanceOf(NumberingRuleNotFoundError);
  });

  it('assigns a plan to tenant scope', async () => {
    const svc = new NumberingPlanService(makeRepo());
    const result = await svc.assign(TENANT, PLAN_ID, 'tenant', null);
    expect(result.assignable_type).toBe('tenant');
  });

  it('checkDial returns matched rule when pattern matches', async () => {
    const svc = new NumberingPlanService(makeRepo());
    const result = await svc.checkDial(TENANT, '+441234567890');
    expect(result.call_type).toBe('international');
    expect(result.matched_rule).toBeDefined();
    expect(result.is_advisory).toBe(true);
  });

  it('checkDial returns no match when dial string does not match any rule', async () => {
    const svc = new NumberingPlanService(makeRepo({ findTenantRules: vi.fn().mockResolvedValue([]) }));
    const result = await svc.checkDial(TENANT, '+14155551234');
    expect(result.call_type).toBeNull();
    expect(result.matched_rule).toBeNull();
  });

  it('checkDial handles invalid regex patterns gracefully', async () => {
    const badRule: NumberingRule = { ...rule, pattern: '[invalid' };
    const svc = new NumberingPlanService(makeRepo({ findTenantRules: vi.fn().mockResolvedValue([badRule]) }));
    const result = await svc.checkDial(TENANT, '+441234567890');
    expect(result.matched_rule).toBeNull();
  });
});
