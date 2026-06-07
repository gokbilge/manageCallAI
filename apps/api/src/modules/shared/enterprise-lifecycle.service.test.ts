import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnterpriseLifecycleService, EnterpriseVersionNotFoundError, EnterpriseVersionStateError, EnterpriseRollbackNotAvailableError } from './enterprise-lifecycle.service.js';
import type { EnterpriseLifecycleRepository } from './enterprise-lifecycle.repository.js';
import type { EnterpriseVersion } from './enterprise-lifecycle.types.js';

function makeVersion(overrides: Partial<EnterpriseVersion> = {}): EnterpriseVersion {
  return {
    id: 'ver-1',
    tenant_id: 'tenant-1',
    object_id: 'obj-1',
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

function makeRepo(overrides: Partial<EnterpriseLifecycleRepository> = {}): EnterpriseLifecycleRepository {
  return {
    createVersion: vi.fn().mockResolvedValue(makeVersion()),
    findVersionById: vi.fn().mockResolvedValue(makeVersion()),
    findVersionsByObject: vi.fn().mockResolvedValue([]),
    nextVersionNumber: vi.fn().mockResolvedValue(1),
    markVersionValidated: vi.fn().mockResolvedValue(makeVersion({ state: 'validated' })),
    markVersionSimulated: vi.fn().mockResolvedValue(makeVersion({ state: 'simulated' })),
    publish: vi.fn().mockResolvedValue(makeVersion({ state: 'published' })),
    rollback: vi.fn().mockResolvedValue(makeVersion({ state: 'published' })),
    createApprovalRequest: vi.fn().mockResolvedValue({ id: 'approval-1' }),
    storePendingPublishRecord: vi.fn().mockResolvedValue(undefined),
    storeValidationResult: vi.fn().mockResolvedValue(undefined),
    storeSimulationResult: vi.fn().mockResolvedValue(undefined),
    getActivePublishPolicy: vi.fn().mockResolvedValue(null),
    ...overrides,
  } as unknown as EnterpriseLifecycleRepository;
}

describe('EnterpriseLifecycleService', () => {
  let repo: ReturnType<typeof makeRepo>;
  let svc: EnterpriseLifecycleService;

  beforeEach(() => {
    repo = makeRepo();
    svc = new EnterpriseLifecycleService(repo);
  });

  describe('createVersion', () => {
    it('creates a version with next version number', async () => {
      vi.mocked(repo.nextVersionNumber).mockResolvedValue(3);
      await svc.createVersion('trunk_group', 'obj-1', 'tenant-1', { foo: 'bar' }, 'user-1');
      expect(repo.createVersion).toHaveBeenCalledWith(expect.objectContaining({
        objectType: 'trunk_group',
        objectId: 'obj-1',
        tenantId: 'tenant-1',
        versionNumber: 3,
        definition: { foo: 'bar' },
        createdBy: 'user-1',
      }));
    });
  });

  describe('validate', () => {
    it('marks version validated when outcome passes', async () => {
      const validator = vi.fn().mockResolvedValue({ status: 'passed', errors: [], warnings: [] });
      const result = await svc.validate('trunk_group', 'obj-1', 'ver-1', 'tenant-1', validator);
      expect(repo.markVersionValidated).toHaveBeenCalledWith('trunk_group', 'ver-1', 'obj-1', 'tenant-1');
      expect(result.outcome.status).toBe('passed');
    });

    it('does not mark validated when outcome fails', async () => {
      const validator = vi.fn().mockResolvedValue({ status: 'failed', errors: [{ field: 'x', message: 'bad' }], warnings: [] });
      const result = await svc.validate('trunk_group', 'obj-1', 'ver-1', 'tenant-1', validator);
      expect(repo.markVersionValidated).not.toHaveBeenCalled();
      expect(result.outcome.status).toBe('failed');
    });

    it('throws EnterpriseVersionNotFoundError when version not found', async () => {
      vi.mocked(repo.findVersionById).mockResolvedValue(null);
      await expect(svc.validate('trunk_group', 'obj-1', 'ver-1', 'tenant-1', vi.fn())).rejects.toThrow(EnterpriseVersionNotFoundError);
    });
  });

  describe('dryRunPublish', () => {
    it('returns would_become published when no approval required', async () => {
      const result = await svc.dryRunPublish('trunk_group', 'obj-1', 'ver-1', 'tenant-1', 'user');
      expect(result.would_become).toBe('published');
      expect(result.require_approval).toBe(false);
    });

    it('returns would_become pending_approval when policy requires approval', async () => {
      vi.mocked(repo.getActivePublishPolicy).mockResolvedValue({ require_approval: true });
      const result = await svc.dryRunPublish('trunk_group', 'obj-1', 'ver-1', 'tenant-1', 'user', 'tenant_admin');
      expect(result.would_become).toBe('pending_approval');
    });

    it('returns would_become pending_approval for ai_agent actor', async () => {
      const result = await svc.dryRunPublish('trunk_group', 'obj-1', 'ver-1', 'tenant-1', 'ai_agent');
      expect(result.would_become).toBe('pending_approval');
    });
  });

  describe('publish', () => {
    it('publishes directly when no approval required and version is validated', async () => {
      vi.mocked(repo.findVersionById).mockResolvedValue(makeVersion({ state: 'validated' }));
      const result = await svc.publish('trunk_group', 'obj-1', 'ver-1', 'tenant-1', 'user-1');
      expect(result.status).toBe('published');
      expect(repo.publish).toHaveBeenCalled();
    });

    it('returns pending_approval when approval required', async () => {
      vi.mocked(repo.findVersionById).mockResolvedValue(makeVersion({ state: 'validated' }));
      vi.mocked(repo.getActivePublishPolicy).mockResolvedValue({ require_approval: true });
      const result = await svc.publish('trunk_group', 'obj-1', 'ver-1', 'tenant-1', 'user-1', 'tenant_admin');
      expect(result.status).toBe('pending_approval');
      expect(repo.createApprovalRequest).toHaveBeenCalled();
      expect(repo.storePendingPublishRecord).toHaveBeenCalled();
    });

    it('throws EnterpriseVersionStateError when version is in draft state', async () => {
      vi.mocked(repo.findVersionById).mockResolvedValue(makeVersion({ state: 'draft' }));
      await expect(svc.publish('trunk_group', 'obj-1', 'ver-1', 'tenant-1', 'user-1')).rejects.toThrow(EnterpriseVersionStateError);
    });

    it('throws EnterpriseVersionNotFoundError when version not found', async () => {
      vi.mocked(repo.findVersionById).mockResolvedValue(null);
      await expect(svc.publish('trunk_group', 'obj-1', 'ver-1', 'tenant-1', 'user-1')).rejects.toThrow(EnterpriseVersionNotFoundError);
    });
  });

  describe('rollback', () => {
    it('rolls back to superseded version', async () => {
      const superseded = makeVersion({ id: 'ver-0', state: 'superseded', version_number: 1 });
      const current = makeVersion({ id: 'ver-1', state: 'published', version_number: 2 });
      vi.mocked(repo.findVersionsByObject).mockResolvedValue([current, superseded]);
      const result = await svc.rollback('trunk_group', 'obj-1', 'tenant-1', 'user-1');
      expect(result.status).toBe('published');
      expect(repo.rollback).toHaveBeenCalled();
    });

    it('throws EnterpriseRollbackNotAvailableError when no superseded version', async () => {
      vi.mocked(repo.findVersionsByObject).mockResolvedValue([makeVersion({ state: 'published' })]);
      await expect(svc.rollback('trunk_group', 'obj-1', 'tenant-1', 'user-1')).rejects.toThrow(EnterpriseRollbackNotAvailableError);
    });

    it('returns pending_approval for rollback when policy requires it', async () => {
      const superseded = makeVersion({ id: 'ver-0', state: 'superseded', version_number: 1 });
      vi.mocked(repo.findVersionsByObject).mockResolvedValue([superseded]);
      vi.mocked(repo.getActivePublishPolicy).mockResolvedValue({ require_approval: true });
      const result = await svc.rollback('trunk_group', 'obj-1', 'tenant-1', 'user-1', 'tenant_admin');
      expect(result.status).toBe('pending_approval');
    });
  });

  describe('simulate', () => {
    it('marks version simulated when simulation passes', async () => {
      const simulator = vi.fn().mockResolvedValue({ status: 'passed', notes: 'ok' });
      const result = await svc.simulate('trunk_group', 'obj-1', 'ver-1', 'tenant-1', {}, simulator);
      expect(repo.markVersionSimulated).toHaveBeenCalled();
      expect(result.outcome.status).toBe('passed');
    });

    it('does not mark simulated when simulation fails', async () => {
      const simulator = vi.fn().mockResolvedValue({ status: 'failed', notes: 'no trunks' });
      await svc.simulate('trunk_group', 'obj-1', 'ver-1', 'tenant-1', {}, simulator);
      expect(repo.markVersionSimulated).not.toHaveBeenCalled();
    });
  });
});
