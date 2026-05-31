import { describe, expect, it, vi } from 'vitest';
import type { AuditRepository } from './audit.repository.js';
import { AuditService } from './audit.service.js';

function makeMockRepo(): AuditRepository {
  return {
    log: vi.fn().mockResolvedValue(undefined),
    find: vi.fn().mockResolvedValue([]),
  } as unknown as AuditRepository;
}

describe('AuditService', () => {
  describe('logEvent', () => {
    it('delegates to repository', async () => {
      const repo = makeMockRepo();
      const service = new AuditService(repo);
      await service.logEvent({
        tenant_id: 'tenant-1',
        actor_id: 'user-1',
        actor_role: 'tenant_admin',
        action: 'approval.approved',
        resource_type: 'approval_request',
        resource_id: 'approval-1',
      });
      expect(repo.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'approval.approved', resource_id: 'approval-1' }),
      );
    });

    it('accepts minimal input without optional fields', async () => {
      const repo = makeMockRepo();
      const service = new AuditService(repo);
      await service.logEvent({ tenant_id: 'tenant-1', action: 'ivr_flow.published', resource_type: 'ivr_flow' });
      expect(repo.log).toHaveBeenCalledOnce();
    });
  });

  describe('getAuditLog', () => {
    it('returns entries from repository', async () => {
      const repo = makeMockRepo();
      const entry = {
        id: 'entry-1',
        tenant_id: 'tenant-1',
        actor_id: 'user-1',
        actor_role: 'tenant_admin',
        action: 'approval.approved',
        resource_type: 'approval_request',
        resource_id: 'approval-1',
        metadata_json: null,
        created_at: '2026-05-29T00:00:00Z',
      };
      vi.mocked(repo.find).mockResolvedValueOnce([entry]);
      const service = new AuditService(repo);
      const result = await service.getAuditLog('tenant-1', { action: 'approval.approved' });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ action: 'approval.approved' });
    });

    it('passes filter to repository', async () => {
      const repo = makeMockRepo();
      const service = new AuditService(repo);
      await service.getAuditLog('tenant-1', { resource_type: 'ivr_flow', limit: 50 });
      expect(repo.find).toHaveBeenCalledWith('tenant-1', { resource_type: 'ivr_flow', limit: 50 });
    });

    it('defaults to empty filter', async () => {
      const repo = makeMockRepo();
      const service = new AuditService(repo);
      await service.getAuditLog('tenant-1');
      expect(repo.find).toHaveBeenCalledWith('tenant-1', {});
    });
  });
});
