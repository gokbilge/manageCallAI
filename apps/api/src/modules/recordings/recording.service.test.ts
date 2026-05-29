import { describe, expect, it, vi } from 'vitest';
import type { RecordingRepository } from './recording.repository.js';
import { RecordingNotFoundError, RecordingService } from './recording.service.js';

const baseRecording = {
  id: 'rec-1',
  tenant_id: 'tenant-1',
  call_id: 'call-abc',
  call_event_id: null,
  storage_path: '/recordings/tenant-1/call-abc.wav',
  duration_secs: 120,
  size_bytes: 1024000,
  status: 'available' as const,
  recorded_at: '2026-05-29T10:00:00Z',
  created_at: '2026-05-29T10:00:01Z',
};

function makeMockRepo(): RecordingRepository {
  return {
    create: vi.fn().mockResolvedValue(baseRecording),
    listByTenant: vi.fn().mockResolvedValue([baseRecording]),
    findById: vi.fn().mockResolvedValue(baseRecording),
  } as unknown as RecordingRepository;
}

describe('RecordingService', () => {
  describe('ingest', () => {
    it('creates and returns a recording', async () => {
      const repo = makeMockRepo();
      const service = new RecordingService(repo);
      const result = await service.ingest({
        tenant_id: 'tenant-1',
        call_id: 'call-abc',
        storage_path: '/recordings/tenant-1/call-abc.wav',
        duration_secs: 120,
      });
      expect(result.id).toBe('rec-1');
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ call_id: 'call-abc' }));
    });
  });

  describe('listByTenant', () => {
    it('returns recordings for the tenant', async () => {
      const repo = makeMockRepo();
      const service = new RecordingService(repo);
      const results = await service.listByTenant('tenant-1');
      expect(results).toHaveLength(1);
      expect(repo.listByTenant).toHaveBeenCalledWith('tenant-1', undefined);
    });

    it('passes call_id filter to repository', async () => {
      const repo = makeMockRepo();
      const service = new RecordingService(repo);
      await service.listByTenant('tenant-1', 'call-abc');
      expect(repo.listByTenant).toHaveBeenCalledWith('tenant-1', 'call-abc');
    });
  });

  describe('getById', () => {
    it('returns a recording when found', async () => {
      const repo = makeMockRepo();
      const service = new RecordingService(repo);
      const result = await service.getById('rec-1', 'tenant-1');
      expect(result.id).toBe('rec-1');
    });

    it('throws RecordingNotFoundError when not found', async () => {
      const repo = makeMockRepo();
      vi.mocked(repo.findById).mockResolvedValueOnce(null);
      const service = new RecordingService(repo);
      await expect(service.getById('missing', 'tenant-1')).rejects.toBeInstanceOf(RecordingNotFoundError);
    });
  });
});
