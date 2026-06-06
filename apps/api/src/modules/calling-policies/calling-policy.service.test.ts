import { describe, expect, it, vi } from 'vitest';
import type { CallingPolicyRepository } from './calling-policy.repository.js';
import { CallingPolicyService, CallingPolicyNotFoundError } from './calling-policy.service.js';
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
