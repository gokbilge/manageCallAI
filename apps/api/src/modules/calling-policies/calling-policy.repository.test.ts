import { describe, it, expect, vi } from 'vitest';
import type { Pool } from 'pg';
import { CallingPolicyRepository } from './calling-policy.repository.js';
import type { CallingPolicy, CallingPolicyAssignment } from './calling-policy.types.js';

const TENANT = 'tenant-1';
const POLICY_ID = 'policy-1';

const basePolicy: CallingPolicy = {
  id: POLICY_ID, tenant_id: TENANT, name: 'Domestic Only', description: null,
  allow_local: true, allow_national: true, allow_mobile: true,
  allow_international: false, allow_premium_rate: false, allow_toll_free: true,
  allow_special: false, emergency_always_allowed: true,
  exceptions: [], status: 'active', created_at: new Date(), updated_at: new Date(),
};

const baseAssignment: CallingPolicyAssignment = {
  id: 'assign-1', tenant_id: TENANT, policy_id: POLICY_ID,
  assignable_type: 'tenant', assignable_id: null, created_at: new Date(),
};

function makePool(rows: unknown[] = []): Pool {
  return { query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }) } as unknown as Pool;
}

describe('CallingPolicyRepository', () => {
  it('create inserts policy and returns it', async () => {
    const pool = makePool([basePolicy]);
    const repo = new CallingPolicyRepository(pool);
    const result = await repo.create(TENANT, { name: 'Domestic Only' });
    expect(result.name).toBe('Domestic Only');
    expect(result.allow_international).toBe(false);
  });

  it('create uses defaults for optional fields', async () => {
    const pool = makePool([basePolicy]);
    const repo = new CallingPolicyRepository(pool);
    await repo.create(TENANT, { name: 'Basic', description: 'desc', exceptions: [{ type: 'allow', prefix: '0800' }] });
    expect(pool.query).toHaveBeenCalledWith(expect.any(String), expect.arrayContaining(['desc']));
  });

  it('findAll returns all policies for tenant', async () => {
    const pool = makePool([basePolicy, { ...basePolicy, id: 'policy-2', name: 'International' }]);
    const repo = new CallingPolicyRepository(pool);
    const result = await repo.findAll(TENANT);
    expect(result).toHaveLength(2);
  });

  it('findById returns policy when found', async () => {
    const pool = makePool([basePolicy]);
    const repo = new CallingPolicyRepository(pool);
    const result = await repo.findById(POLICY_ID, TENANT);
    expect(result?.id).toBe(POLICY_ID);
  });

  it('findById returns null when not found', async () => {
    const pool = makePool([]);
    const repo = new CallingPolicyRepository(pool);
    const result = await repo.findById('missing', TENANT);
    expect(result).toBeNull();
  });

  it('update builds dynamic SET clause and returns updated policy', async () => {
    const updated = { ...basePolicy, name: 'Updated', allow_international: true };
    const pool = makePool([updated]);
    const repo = new CallingPolicyRepository(pool);
    const result = await repo.update(POLICY_ID, TENANT, {
      name: 'Updated',
      allow_local: true,
      allow_national: true,
      allow_mobile: false,
      allow_international: true,
      allow_premium_rate: true,
      allow_toll_free: false,
      allow_special: true,
      emergency_always_allowed: false,
      exceptions: [],
      status: 'inactive',
      description: 'Updated description',
    });
    expect(result?.name).toBe('Updated');
  });

  it('update returns null when policy not found', async () => {
    const pool = makePool([]);
    const repo = new CallingPolicyRepository(pool);
    const result = await repo.update('missing', TENANT, { name: 'X' });
    expect(result).toBeNull();
  });

  it('delete returns true when policy deleted', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }) } as unknown as Pool;
    const repo = new CallingPolicyRepository(pool);
    const result = await repo.delete(POLICY_ID, TENANT);
    expect(result).toBe(true);
  });

  it('delete returns false when policy not found', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) } as unknown as Pool;
    const repo = new CallingPolicyRepository(pool);
    const result = await repo.delete('missing', TENANT);
    expect(result).toBe(false);
  });

  it('assign upserts assignment and returns it', async () => {
    const pool = makePool([baseAssignment]);
    const repo = new CallingPolicyRepository(pool);
    const result = await repo.assign(TENANT, POLICY_ID, 'tenant', null);
    expect(result.policy_id).toBe(POLICY_ID);
    expect(result.assignable_type).toBe('tenant');
  });

  it('assign accepts non-null assignable_id for extension scope', async () => {
    const assignment = { ...baseAssignment, assignable_type: 'extension' as const, assignable_id: 'ext-1' };
    const pool = makePool([assignment]);
    const repo = new CallingPolicyRepository(pool);
    const result = await repo.assign(TENANT, POLICY_ID, 'extension', 'ext-1');
    expect(result.assignable_id).toBe('ext-1');
  });

  it('findTenantPolicy returns policy joined from assignment', async () => {
    const pool = makePool([basePolicy]);
    const repo = new CallingPolicyRepository(pool);
    const result = await repo.findTenantPolicy(TENANT);
    expect(result?.id).toBe(POLICY_ID);
  });

  it('findTenantPolicy returns null when no tenant assignment', async () => {
    const pool = makePool([]);
    const repo = new CallingPolicyRepository(pool);
    const result = await repo.findTenantPolicy(TENANT);
    expect(result).toBeNull();
  });
});
