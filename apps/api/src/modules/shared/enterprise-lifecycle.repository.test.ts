import { describe, it, expect, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { EnterpriseLifecycleRepository } from './enterprise-lifecycle.repository.js';

function makeRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'ver-1',
    tenant_id: 'tenant-1',
    trunk_group_id: 'obj-1',
    version_number: 1,
    state: 'draft',
    definition: {},
    created_by: null,
    created_at: new Date(),
    validated_at: null,
    simulated_at: null,
    published_at: null,
    metadata: {},
    ...overrides,
  };
}

function makePool(queryResult: Record<string, unknown>[] = []): Pool {
  return {
    query: vi.fn().mockResolvedValue({ rows: queryResult }),
    connect: vi.fn(),
  } as unknown as Pool;
}

function makeClient(queryResults: Record<string, unknown>[][] = []): { client: PoolClient; pool: Pool } {
  let callIndex = 0;
  const client: PoolClient = {
    query: vi.fn().mockImplementation(() => {
      const rows = queryResults[callIndex++] ?? [];
      return Promise.resolve({ rows });
    }),
    release: vi.fn(),
  } as unknown as PoolClient;
  const pool = { ...makePool(), connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;
  return { client, pool };
}

describe('EnterpriseLifecycleRepository', () => {
  describe('createVersion', () => {
    it('inserts a version record and returns it', async () => {
      const row = makeRow();
      const pool = makePool([row]);
      const repo = new EnterpriseLifecycleRepository(pool);
      const result = await repo.createVersion({
        objectType: 'trunk_group', objectId: 'obj-1', tenantId: 'tenant-1',
        versionNumber: 1, definition: { x: 1 }, createdBy: 'user-1',
      });
      expect(result.id).toBe('ver-1');
      expect(result.object_id).toBe('obj-1');
      expect(result.version_number).toBe(1);
    });
  });

  describe('findVersionById', () => {
    it('returns version when found', async () => {
      const pool = makePool([makeRow()]);
      const repo = new EnterpriseLifecycleRepository(pool);
      const result = await repo.findVersionById('trunk_group', 'ver-1', 'obj-1', 'tenant-1');
      expect(result?.id).toBe('ver-1');
    });

    it('returns null when not found', async () => {
      const pool = makePool([]);
      const repo = new EnterpriseLifecycleRepository(pool);
      const result = await repo.findVersionById('trunk_group', 'missing', 'obj-1', 'tenant-1');
      expect(result).toBeNull();
    });
  });

  describe('findVersionsByObject', () => {
    it('returns all versions for an object', async () => {
      const pool = makePool([makeRow(), makeRow({ id: 'ver-2', version_number: 2 })]);
      const repo = new EnterpriseLifecycleRepository(pool);
      const result = await repo.findVersionsByObject('trunk_group', 'obj-1', 'tenant-1');
      expect(result).toHaveLength(2);
    });
  });

  describe('nextVersionNumber', () => {
    it('returns next version number from DB', async () => {
      const pool = { query: vi.fn().mockResolvedValue({ rows: [{ next: 3 }] }) } as unknown as Pool;
      const repo = new EnterpriseLifecycleRepository(pool);
      const result = await repo.nextVersionNumber('trunk_group', 'obj-1');
      expect(result).toBe(3);
    });
  });

  describe('markVersionValidated', () => {
    it('returns updated version when found', async () => {
      const pool = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [makeRow({ state: 'validated' })] })
          .mockResolvedValueOnce({ rows: [] }),
      } as unknown as Pool;
      const repo = new EnterpriseLifecycleRepository(pool);
      const result = await repo.markVersionValidated('trunk_group', 'ver-1', 'obj-1', 'tenant-1');
      expect(result?.state).toBe('validated');
    });

    it('returns null when version not found', async () => {
      const pool = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      } as unknown as Pool;
      const repo = new EnterpriseLifecycleRepository(pool);
      const result = await repo.markVersionValidated('trunk_group', 'ver-1', 'obj-1', 'tenant-1');
      expect(result).toBeNull();
    });
  });

  describe('markVersionSimulated', () => {
    it('returns updated version when found', async () => {
      const pool = makePool([makeRow({ state: 'simulated' })]);
      const repo = new EnterpriseLifecycleRepository(pool);
      const result = await repo.markVersionSimulated('trunk_group', 'ver-1', 'obj-1', 'tenant-1');
      expect(result?.state).toBe('simulated');
    });

    it('returns null when version not found', async () => {
      const pool = makePool([]);
      const repo = new EnterpriseLifecycleRepository(pool);
      const result = await repo.markVersionSimulated('trunk_group', 'ver-1', 'obj-1', 'tenant-1');
      expect(result).toBeNull();
    });
  });

  describe('publish', () => {
    it('publishes version in a transaction and returns it', async () => {
      const publishedRow = makeRow({ state: 'published' });
      const { client, pool } = makeClient([
        [], // BEGIN
        [], // UPDATE supersede
        [publishedRow], // UPDATE publish
        [], // UPDATE active_version_id
        [], // INSERT publish_record
        [], // INSERT audit_event
        [], // COMMIT
      ]);
      const repo = new EnterpriseLifecycleRepository(pool);
      const result = await repo.publish({
        objectType: 'trunk_group', objectId: 'obj-1', versionId: 'ver-1',
        tenantId: 'tenant-1', triggeredById: 'user-1', triggeredByType: 'user',
      });
      expect(result.state).toBe('published');
      expect(client.release).toHaveBeenCalled();
    });

    it('rolls back transaction on error', async () => {
      const client: PoolClient = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockRejectedValueOnce(new Error('DB error')), // fails on supersede
        release: vi.fn(),
      } as unknown as PoolClient;
      const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;
      const repo = new EnterpriseLifecycleRepository(pool);
      await expect(repo.publish({
        objectType: 'trunk_group', objectId: 'obj-1', versionId: 'ver-1',
        tenantId: 'tenant-1', triggeredById: 'user-1', triggeredByType: 'user',
      })).rejects.toThrow('DB error');
      expect(client.release).toHaveBeenCalled();
    });
  });

  describe('rollback', () => {
    it('restores superseded version in a transaction', async () => {
      const supersededRow = makeRow({ state: 'superseded' });
      const restoredRow = makeRow({ state: 'published' });
      const { client, pool } = makeClient([
        [],               // BEGIN
        [supersededRow],  // SELECT target
        [],               // UPDATE rolled_back
        [restoredRow],    // UPDATE restore to published
        [],               // UPDATE active_version_id
        [],               // INSERT publish_record
        [],               // INSERT audit_event
        [],               // COMMIT
      ]);
      const repo = new EnterpriseLifecycleRepository(pool);
      const result = await repo.rollback({
        objectType: 'trunk_group', objectId: 'obj-1',
        tenantId: 'tenant-1', triggeredById: 'user-1', triggeredByType: 'user',
      });
      expect(result?.state).toBe('published');
      expect(client.release).toHaveBeenCalled();
    });

    it('returns null when no superseded version exists', async () => {
      const { client, pool } = makeClient([
        [], // BEGIN
        [], // SELECT target — empty
        [], // ROLLBACK
      ]);
      const repo = new EnterpriseLifecycleRepository(pool);
      const result = await repo.rollback({
        objectType: 'trunk_group', objectId: 'obj-1',
        tenantId: 'tenant-1', triggeredById: 'user-1', triggeredByType: 'user',
      });
      expect(result).toBeNull();
      expect(client.release).toHaveBeenCalled();
    });

    it('rolls back transaction on error', async () => {
      const client: PoolClient = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [] }) // BEGIN
          .mockRejectedValueOnce(new Error('DB error')),
        release: vi.fn(),
      } as unknown as PoolClient;
      const pool = { connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;
      const repo = new EnterpriseLifecycleRepository(pool);
      await expect(repo.rollback({
        objectType: 'trunk_group', objectId: 'obj-1',
        tenantId: 'tenant-1', triggeredById: 'user-1', triggeredByType: 'user',
      })).rejects.toThrow('DB error');
      expect(client.release).toHaveBeenCalled();
    });
  });

  describe('createApprovalRequest', () => {
    it('inserts and returns the new approval request id', async () => {
      const pool = makePool([{ id: 'approval-1' }]);
      const repo = new EnterpriseLifecycleRepository(pool);
      const result = await repo.createApprovalRequest({
        tenantId: 'tenant-1', objectType: 'trunk_group', objectId: 'obj-1',
        versionId: 'ver-1', requestedBy: 'user-1',
      });
      expect(result.id).toBe('approval-1');
    });
  });

  describe('storePendingPublishRecord', () => {
    it('inserts a pending publish record', async () => {
      const pool = makePool([]);
      const repo = new EnterpriseLifecycleRepository(pool);
      await expect(repo.storePendingPublishRecord({
        tenantId: 'tenant-1', objectType: 'trunk_group', objectId: 'obj-1',
        versionId: 'ver-1', triggeredById: 'user-1', triggeredByType: 'user',
        approvalRequestId: 'approval-1', actionType: 'publish',
      })).resolves.toBeUndefined();
    });
  });

  describe('storeValidationResult', () => {
    it('inserts validation result', async () => {
      const pool = makePool([]);
      const repo = new EnterpriseLifecycleRepository(pool);
      await expect(repo.storeValidationResult({
        tenantId: 'tenant-1', objectType: 'trunk_group', objectId: 'obj-1', versionId: 'ver-1',
        outcome: { status: 'passed', errors: [], warnings: [] },
      })).resolves.toBeUndefined();
    });
  });

  describe('storeSimulationResult', () => {
    it('inserts simulation result', async () => {
      const pool = makePool([]);
      const repo = new EnterpriseLifecycleRepository(pool);
      await expect(repo.storeSimulationResult({
        tenantId: 'tenant-1', objectType: 'trunk_group', objectId: 'obj-1', versionId: 'ver-1',
        scenario: { dial_string: '+1234' }, outcome: { status: 'passed' },
      })).resolves.toBeUndefined();
    });
  });

  describe('getActivePublishPolicy', () => {
    it('returns policy when active one exists', async () => {
      const pool = makePool([{ require_approval: true }]);
      const repo = new EnterpriseLifecycleRepository(pool);
      const result = await repo.getActivePublishPolicy('tenant-1');
      expect(result?.require_approval).toBe(true);
    });

    it('returns null when no active policy', async () => {
      const pool = makePool([]);
      const repo = new EnterpriseLifecycleRepository(pool);
      const result = await repo.getActivePublishPolicy('tenant-1');
      expect(result).toBeNull();
    });
  });

  describe('versionRow mapping', () => {
    it('handles all object types correctly', async () => {
      const fkMap: Record<string, string> = {
        trunk_group: 'trunk_group_id',
        numbering_plan: 'numbering_plan_id',
        calling_policy: 'calling_policy_id',
        site: 'site_id',
        schedule: 'schedule_id',
        line_appearance: 'line_appearance_id',
      };
      for (const [objectType, fk] of Object.entries(fkMap) as [string, string][]) {
        const baseRow = { id: 'ver-1', tenant_id: 'tenant-1', version_number: 1, state: 'draft', definition: {}, created_by: null, created_at: new Date(), validated_at: null, simulated_at: null, published_at: null, metadata: {} };
        const row = { ...baseRow, [fk]: 'obj-x' };
        const pool = makePool([row]);
        const repo = new EnterpriseLifecycleRepository(pool);
        const result = await repo.findVersionsByObject(objectType as import('./enterprise-lifecycle.types.js').EnterpriseObjectType, 'obj-x', 'tenant-1');
        expect(result[0]!.object_id).toBe('obj-x');
      }
    });
  });
});
