import { describe, expect, it, vi } from 'vitest';
import type { RecordingRepository } from './recording.repository.js';
import { RecordingNotFoundError, RecordingPlaybackPathError, RecordingService } from './recording.service.js';

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
    createAnalysisRequest: vi.fn().mockResolvedValue({
      id: 'analysis-1',
      tenant_id: 'tenant-1',
      recording_id: 'rec-1',
      requested_outputs: ['transcript', 'summary'],
      language_hint: 'en-US',
      status: 'queued',
      processor_id: null,
      claimed_at: null,
      language: null,
      transcript_text: null,
      summary_text: null,
      error_message: null,
      provider_metadata: {},
      metadata: {},
      created_at: '2026-05-29T10:00:02Z',
      completed_at: null,
    }),
    listAnalysisRequests: vi.fn().mockResolvedValue([]),
    findAnalysisRequest: vi.fn().mockResolvedValue(null),
    claimAnalysisRequest: vi.fn().mockResolvedValue(null),
    completeAnalysisRequest: vi.fn().mockResolvedValue(null),
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

  describe('getPlaybackPath', () => {
    it('resolves recording media under the configured storage root', async () => {
      const repo = makeMockRepo();
      vi.mocked(repo.findById).mockResolvedValueOnce({ ...baseRecording, storage_path: 'tenant-1/call-abc.wav' });
      const service = new RecordingService(repo, 'recordings');

      const playback = await service.getPlaybackPath('rec-1', 'tenant-1');

      expect(playback.file_path).toContain('tenant-1');
      expect(playback.recording.id).toBe('rec-1');
    });

    it('rejects storage paths outside the configured root', async () => {
      const repo = makeMockRepo();
      vi.mocked(repo.findById).mockResolvedValueOnce({ ...baseRecording, storage_path: '../secret.wav' });
      const service = new RecordingService(repo, 'recordings');

      await expect(service.getPlaybackPath('rec-1', 'tenant-1')).rejects.toBeInstanceOf(RecordingPlaybackPathError);
    });
  });

  describe('recording analysis requests', () => {
    it('creates a provider-neutral analysis request for a tenant-owned recording', async () => {
      const repo = makeMockRepo();
      const service = new RecordingService(repo);

      const result = await service.createAnalysisRequest('rec-1', 'tenant-1', {
        requested_outputs: ['transcript', 'summary'],
        language_hint: 'en-US',
      });

      expect(result.status).toBe('queued');
      expect(repo.createAnalysisRequest).toHaveBeenCalledWith('rec-1', 'tenant-1', expect.objectContaining({
        requested_outputs: ['transcript', 'summary'],
      }));
    });

    it('checks the parent recording before listing analysis requests', async () => {
      const repo = makeMockRepo();
      const service = new RecordingService(repo);

      await service.listAnalysisRequests('rec-1', 'tenant-1');

      expect(repo.findById).toHaveBeenCalledWith('rec-1', 'tenant-1');
      expect(repo.listAnalysisRequests).toHaveBeenCalledWith('rec-1', 'tenant-1');
    });
  });
});
