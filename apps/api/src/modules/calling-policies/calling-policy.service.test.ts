import { describe, expect, it, vi } from 'vitest';
import type { CallingPolicyRepository } from './calling-policy.repository.js';
import { CallingPolicyService, CallingPolicyNotFoundError } from './calling-policy.service.js';
import type { EnterpriseLifecycleService } from '../shared/enterprise-lifecycle.service.js';
import type { EnterpriseVersion, EnterpriseValidationResult, EnterpriseSimulationResult, EnterpriseDryRunResult, EnterprisePublishAttemptResult } from '../shared/enterprise-lifecycle.types.js';
import type { CallingPolicy } from './calling-policy.types.js';

const TENANT = 'tenant-1';

const policy: CallingPolicy = {
  id: 'policy-1', tenant_id: TENANT, name: 'Domestic Only', description: null,
  allow_local: true, allow_national: true, allow_mobile: true,
  allow_international: false, allow_premium_rate: false, allow_toll_free: true,
  allow_special: false, emergency_always_allowed: true,
  exceptions: [], status: 'active', created_at: new Date(), updated_at: new Date(),
};

function makeRepo(overrides: Partial<CallingPolicyRepository> = {}): CallingPolicyRepository {
  return {
    create: vi.fn().mockResolvedValue(policy),
    findAll: vi.fn().mockResolvedValue([policy]),
    findById: vi.fn().mockResolvedValue(policy),
    update: vi.fn().mockResolvedValue({ ...policy, name: 'Updated' }),
    delete: vi.fn().mockResolvedValue(true),
    assign: vi.fn().mockResolvedValue({ id: 'a-1', tenant_id: TENANT, policy_id: 'policy-1', assignable_type: 'tenant', assignable_id: null, created_at: new Date() }),
    findTenantPolicy: vi.fn().mockResolvedValue(policy),
    ...overrides,
  } as unknown as CallingPolicyRepository;
}

describe('CallingPolicyService', () => {
  it('creates a calling policy', async () => {
    const svc = new CallingPolicyService(makeRepo());
    const r = await svc.create(TENANT, { name: 'Domestic Only' });
    expect(r.name).toBe('Domestic Only');
  });

  it('lists policies', async () => {
    const svc = new CallingPolicyService(makeRepo());
    expect(await svc.list(TENANT)).toHaveLength(1);
  });

  it('gets policy by id', async () => {
    const svc = new CallingPolicyService(makeRepo());
    const r = await svc.getById('policy-1', TENANT);
    expect(r.allow_international).toBe(false);
  });

  it('throws CallingPolicyNotFoundError when missing', async () => {
    const svc = new CallingPolicyService(makeRepo({ findById: vi.fn().mockResolvedValue(null) }));
    await expect(svc.getById('missing', TENANT)).rejects.toBeInstanceOf(CallingPolicyNotFoundError);
  });

  it('checkCallType returns allowed for permitted call type', async () => {
    const svc = new CallingPolicyService(makeRepo());
    const r = await svc.checkCallType(TENANT, 'local');
    expect(r.allowed).toBe(true);
    expect(r.is_advisory).toBe(true);
  });

  it('checkCallType returns not allowed for blocked call type', async () => {
    const svc = new CallingPolicyService(makeRepo());
    const r = await svc.checkCallType(TENANT, 'international');
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('Domestic Only');
  });

  it('checkCallType always allows emergency when emergency_always_allowed', async () => {
    const svc = new CallingPolicyService(makeRepo());
    const r = await svc.checkCallType(TENANT, 'emergency');
    expect(r.allowed).toBe(true);
    expect(r.reason).toContain('Emergency');
  });

  it('checkCallType allows all when no tenant policy assigned', async () => {
    const svc = new CallingPolicyService(makeRepo({ findTenantPolicy: vi.fn().mockResolvedValue(null) }));
    const r = await svc.checkCallType(TENANT, 'international');
    expect(r.allowed).toBe(true);
    expect(r.policy_id).toBeNull();
  });

  it('assigns a policy to tenant scope', async () => {
    const svc = new CallingPolicyService(makeRepo());
    const r = await svc.assign(TENANT, 'policy-1', 'tenant', null);
    expect(r.assignable_type).toBe('tenant');
  });
});

function makeVersion(overrides: Partial<EnterpriseVersion> = {}): EnterpriseVersion {
  return { id: 'ver-1', tenant_id: TENANT, object_id: 'policy-1', version_number: 1, state: 'draft', definition: {}, created_by: null, created_at: new Date(), validated_at: null, simulated_at: null, published_at: null, metadata: {}, ...overrides };
}

function makeLifecycle(overrides: Partial<EnterpriseLifecycleService> = {}): EnterpriseLifecycleService {
  const v = makeVersion();
  const validResult: EnterpriseValidationResult = { version: v, outcome: { status: 'passed', errors: [], warnings: [] } };
  const simResult: EnterpriseSimulationResult = { version: v, outcome: { status: 'passed' } };
  const dryRun: EnterpriseDryRunResult = { dry_run: true, would_become: 'published', require_approval: false, version_state_valid: true, actor_type: 'user' };
  const publishResult: EnterprisePublishAttemptResult = { status: 'published', version: makeVersion({ state: 'published' }) };
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

describe('CallingPolicyService — lifecycle', () => {
  it('createVersion delegates to lifecycle service', async () => {
    const lc = makeLifecycle();
    const svc = new CallingPolicyService(makeRepo(), lc);
    await svc.createVersion('policy-1', TENANT, { x: 1 }, 'user-1');
    expect(lc.createVersion).toHaveBeenCalledWith('calling_policy', 'policy-1', TENANT, { x: 1 }, 'user-1', undefined);
  });

  it('listVersions delegates to lifecycle service', async () => {
    const lc = makeLifecycle();
    const svc = new CallingPolicyService(makeRepo(), lc);
    const result = await svc.listVersions('policy-1', TENANT);
    expect(result).toHaveLength(1);
    expect(lc.listVersions).toHaveBeenCalledWith('calling_policy', 'policy-1', TENANT);
  });

  it('validate passes when policy has a name', async () => {
    const lc = makeLifecycle();
    const svc = new CallingPolicyService(makeRepo(), lc);
    const result = await svc.validate('policy-1', 'ver-1', TENANT);
    expect(result.outcome.status).toBe('passed');
    expect(result.outcome.errors).toHaveLength(0);
  });

  it('validate fails when policy name is empty', async () => {
    const lc = makeLifecycle();
    const svc = new CallingPolicyService(makeRepo({ findById: vi.fn().mockResolvedValue({ ...policy, name: '  ' }) }), lc);
    const result = await svc.validate('policy-1', 'ver-1', TENANT);
    expect(result.outcome.status).toBe('failed');
    expect(result.outcome.errors[0]!.field).toBe('name');
  });

  it('validate throws CallingPolicyNotFoundError when policy missing', async () => {
    const lc = makeLifecycle();
    const svc = new CallingPolicyService(makeRepo({ findById: vi.fn().mockResolvedValue(null) }), lc);
    await expect(svc.validate('missing', 'ver-1', TENANT)).rejects.toBeInstanceOf(CallingPolicyNotFoundError);
  });

  it('simulate delegates to lifecycle service', async () => {
    const lc = makeLifecycle();
    const svc = new CallingPolicyService(makeRepo(), lc);
    const result = await svc.simulate('policy-1', 'ver-1', TENANT, 'international');
    expect(result.outcome).toMatchObject({ allowed: false });
  });

  it('dryRunPublish delegates to lifecycle service', async () => {
    const lc = makeLifecycle();
    const svc = new CallingPolicyService(makeRepo(), lc);
    const result = await svc.dryRunPublish('policy-1', 'ver-1', TENANT);
    expect(result.would_become).toBe('published');
    expect(lc.dryRunPublish).toHaveBeenCalledWith('calling_policy', 'policy-1', 'ver-1', TENANT, 'user', undefined);
  });

  it('publish delegates to lifecycle service', async () => {
    const lc = makeLifecycle();
    const svc = new CallingPolicyService(makeRepo(), lc);
    const result = await svc.publish('policy-1', 'ver-1', TENANT, 'user-1');
    expect(result.status).toBe('published');
    expect(lc.publish).toHaveBeenCalled();
  });

  it('rollback delegates to lifecycle service', async () => {
    const lc = makeLifecycle();
    const svc = new CallingPolicyService(makeRepo(), lc);
    const result = await svc.rollback('policy-1', TENANT, 'user-1');
    expect(result.status).toBe('published');
    expect(lc.rollback).toHaveBeenCalled();
  });

  it('lifecycle getter throws when lifecycleSvc not provided', async () => {
    const svc = new CallingPolicyService(makeRepo());
    expect(() => svc.createVersion('policy-1', TENANT, {})).toThrow('EnterpriseLifecycleService not provided');
  });
});
