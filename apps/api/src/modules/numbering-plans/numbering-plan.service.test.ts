import { describe, expect, it, vi } from 'vitest';
import type { NumberingPlanRepository } from './numbering-plan.repository.js';
import {
  NumberingPlanService,
  NumberingPlanNotFoundError,
  NumberingRuleNotFoundError,
} from './numbering-plan.service.js';
import type { NumberingPlan, NumberingRule, NumberingPlanWithRules } from './numbering-plan.types.js';
import type { EnterpriseLifecycleService } from '../shared/enterprise-lifecycle.service.js';
import type { EnterpriseVersion, EnterprisePublishAttemptResult, EnterpriseDryRunResult } from '../shared/enterprise-lifecycle.types.js';

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

function makeVersion(overrides: Partial<EnterpriseVersion> = {}): EnterpriseVersion {
  return { id: 'ver-1', tenant_id: TENANT, object_id: PLAN_ID, version_number: 1, state: 'draft', definition: {}, created_by: null, created_at: new Date(), validated_at: null, simulated_at: null, published_at: null, metadata: {}, ...overrides };
}

function makeLifecycle(overrides: Partial<EnterpriseLifecycleService> = {}): EnterpriseLifecycleService {
  const v = makeVersion();
  const publishResult: EnterprisePublishAttemptResult = { status: 'published', version: makeVersion({ state: 'published' }) };
  const dryRun: EnterpriseDryRunResult = { dry_run: true, would_become: 'published', require_approval: false, version_state_valid: true, actor_type: 'user' };
  return {
    createVersion: vi.fn().mockResolvedValue(v),
    listVersions: vi.fn().mockResolvedValue([v]),
    validate: vi.fn().mockImplementation(async (_ot, _oid, _vid, _tid, validatorFn) => { const outcome = await validatorFn(v); return { version: v, outcome }; }),
    simulate: vi.fn().mockImplementation(async (_ot, _oid, _vid, _tid, _sc, simFn) => { const outcome = await simFn(v, {}); return { version: v, outcome }; }),
    dryRunPublish: vi.fn().mockResolvedValue(dryRun),
    publish: vi.fn().mockResolvedValue(publishResult),
    rollback: vi.fn().mockResolvedValue(publishResult),
    ...overrides,
  } as unknown as EnterpriseLifecycleService;
}

describe('NumberingPlanService — lifecycle', () => {
  it('createVersion delegates to lifecycle service', async () => {
    const lc = makeLifecycle();
    const svc = new NumberingPlanService(makeRepo(), lc);
    await svc.createVersion(PLAN_ID, TENANT, { x: 1 }, 'user-1');
    expect(lc.createVersion).toHaveBeenCalledWith('numbering_plan', PLAN_ID, TENANT, { x: 1 }, 'user-1', undefined);
  });

  it('listVersions delegates to lifecycle service', async () => {
    const lc = makeLifecycle();
    const svc = new NumberingPlanService(makeRepo(), lc);
    const result = await svc.listVersions(PLAN_ID, TENANT);
    expect(result).toHaveLength(1);
  });

  it('validate passes when all rule patterns are valid regex', async () => {
    const lc = makeLifecycle();
    const svc = new NumberingPlanService(makeRepo(), lc);
    const result = await svc.validate(PLAN_ID, 'ver-1', TENANT);
    expect(result.outcome.status).toBe('passed');
  });

  it('validate fails when a rule has invalid regex pattern', async () => {
    const lc = makeLifecycle();
    const badPlan: NumberingPlanWithRules = { ...planWithRules, rules: [{ ...rule, pattern: '[invalid' }] };
    const svc = new NumberingPlanService(makeRepo({ findById: vi.fn().mockResolvedValue(badPlan) }), lc);
    const result = await svc.validate(PLAN_ID, 'ver-1', TENANT);
    expect(result.outcome.status).toBe('failed');
    expect(result.outcome.errors[0]!.field).toContain('pattern');
  });

  it('validate throws NumberingPlanNotFoundError when plan missing', async () => {
    const lc = makeLifecycle();
    const svc = new NumberingPlanService(makeRepo({ findById: vi.fn().mockResolvedValue(null) }), lc);
    await expect(svc.validate('missing', 'ver-1', TENANT)).rejects.toBeInstanceOf(NumberingPlanNotFoundError);
  });

  it('simulate delegates to lifecycle service with checkDial result', async () => {
    const lc = makeLifecycle();
    const svc = new NumberingPlanService(makeRepo(), lc);
    const result = await svc.simulate(PLAN_ID, 'ver-1', TENANT, '+441234567890');
    expect(result.outcome).toMatchObject({ call_type: 'international' });
  });

  it('dryRunPublish delegates to lifecycle service', async () => {
    const lc = makeLifecycle();
    const svc = new NumberingPlanService(makeRepo(), lc);
    const result = await svc.dryRunPublish(PLAN_ID, 'ver-1', TENANT);
    expect(result.would_become).toBe('published');
  });

  it('publish delegates to lifecycle service', async () => {
    const lc = makeLifecycle();
    const svc = new NumberingPlanService(makeRepo(), lc);
    const result = await svc.publish(PLAN_ID, 'ver-1', TENANT, 'user-1');
    expect(result.status).toBe('published');
  });

  it('rollback delegates to lifecycle service', async () => {
    const lc = makeLifecycle();
    const svc = new NumberingPlanService(makeRepo(), lc);
    const result = await svc.rollback(PLAN_ID, TENANT, 'user-1');
    expect(result.status).toBe('published');
  });

  it('lifecycle getter throws when lifecycleSvc not provided', async () => {
    const svc = new NumberingPlanService(makeRepo());
    expect(() => svc.createVersion(PLAN_ID, TENANT, {})).toThrow('EnterpriseLifecycleService not provided');
  });
});
