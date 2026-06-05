import { describe, expect, it, vi } from 'vitest';
import type { RecordingRepository } from './recording.repository.js';
import { RecordingNotFoundError, RecordingPlaybackPathError, RecordingService } from './recording.service.js';
import type { LegalHold, TenantRetentionPolicy } from './recording.types.js';

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

const basePolicy: TenantRetentionPolicy = {
  id: 'policy-1',
  tenant_id: 'tenant-1',
  recording_retention_days: 90,
  voicemail_retention_days: 90,
  transcript_retention_days: 180,
  ai_summary_retention_days: 180,
  cdr_retention_days: 365,
  call_event_retention_days: 365,
  generated_media_retention_days: 180,
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
};

const baseHold: LegalHold = {
  id: 'hold-1',
  tenant_id: 'tenant-1',
  resource_type: 'recording',
  resource_id: null,
  initiated_by: 'user-1',
  case_reference: 'CASE-001',
  reason: 'Regulatory hold',
  status: 'active',
  released_by: null,
  released_at: null,
  expires_at: null,
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
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
    findLatestByCallId: vi.fn().mockResolvedValue(baseRecording),
    findAnalysisRequest: vi.fn().mockResolvedValue(null),
    findLatestAnalysisRequestForRecording: vi.fn().mockResolvedValue({
      id: 'analysis-1',
      tenant_id: 'tenant-1',
      recording_id: 'rec-1',
      requested_outputs: ['transcript', 'summary'],
      language_hint: 'en-US',
      status: 'completed',
      processor_id: 'processor-1',
      claimed_at: '2026-05-29T10:00:03Z',
      language: 'en',
      transcript_text: 'Transcript',
      summary_text: 'Summary',
      error_message: null,
      provider_metadata: {},
      metadata: {},
      created_at: '2026-05-29T10:00:02Z',
      completed_at: '2026-05-29T10:01:00Z',
    }),
    claimAnalysisRequest: vi.fn().mockResolvedValue(null),
    completeAnalysisRequest: vi.fn().mockResolvedValue(null),
    // SLICE-47
    getRetentionPolicy: vi.fn().mockResolvedValue(basePolicy),
    upsertRetentionPolicy: vi.fn().mockResolvedValue(basePolicy),
    createLegalHold: vi.fn().mockResolvedValue(baseHold),
    listLegalHolds: vi.fn().mockResolvedValue([baseHold]),
    findLegalHold: vi.fn().mockResolvedValue(baseHold),
    releaseLegalHold: vi.fn().mockResolvedValue({ ...baseHold, status: 'released', released_by: 'user-1', released_at: '2026-06-01T01:00:00Z' }),
    hasActiveLegalHold: vi.fn().mockResolvedValue(false),
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

  describe('summary review', () => {
    it('normalizes completed_at values to ISO strings for response serialization', async () => {
      const repo = makeMockRepo();
      vi.mocked(repo.findLatestAnalysisRequestForRecording).mockResolvedValueOnce({
        id: 'analysis-1',
        tenant_id: 'tenant-1',
        recording_id: 'rec-1',
        requested_outputs: ['transcript', 'summary'],
        language_hint: 'en-US',
        status: 'completed',
        processor_id: 'processor-1',
        claimed_at: '2026-06-05T08:00:00Z',
        language: 'en',
        transcript_text: 'Transcript',
        summary_text: 'Summary',
        error_message: null,
        provider_metadata: {},
        metadata: {},
        created_at: '2026-06-05T08:00:00Z',
        completed_at: new Date('2026-06-05T08:05:00.000Z') as unknown as string,
      });
      const service = new RecordingService(repo);

      const review = await service.getSummaryReviewForRecording('rec-1', 'tenant-1', {
        canViewTranscript: true,
      });

      expect(review.status).toBe('completed');
      expect(review.completed_at).toBe('2026-06-05T08:05:00.000Z');
      expect(review.provider_metadata).toEqual({});
    });
  });

  // ── SLICE-47: Retention policy ────────────────────────────────────────────

  describe('getRetentionPolicy', () => {
    it('returns the retention policy for the tenant', async () => {
      const repo = makeMockRepo();
      const service = new RecordingService(repo);
      const policy = await service.getRetentionPolicy('tenant-1');
      expect(policy?.recording_retention_days).toBe(90);
      expect(repo.getRetentionPolicy).toHaveBeenCalledWith('tenant-1');
    });

    it('returns null for a tenant with no policy', async () => {
      const repo = makeMockRepo();
      vi.mocked(repo.getRetentionPolicy).mockResolvedValueOnce(null);
      const service = new RecordingService(repo);
      const policy = await service.getRetentionPolicy('tenant-1');
      expect(policy).toBeNull();
    });
  });

  describe('updateRetentionPolicy', () => {
    it('upserts the retention policy and returns updated values', async () => {
      const repo = makeMockRepo();
      vi.mocked(repo.upsertRetentionPolicy).mockResolvedValueOnce({
        ...basePolicy,
        recording_retention_days: 30,
      });
      const service = new RecordingService(repo);
      const policy = await service.updateRetentionPolicy('tenant-1', { recording_retention_days: 30 });
      expect(policy.recording_retention_days).toBe(30);
      expect(repo.upsertRetentionPolicy).toHaveBeenCalledWith('tenant-1', { recording_retention_days: 30 });
    });

    it('allows setting retention to null (indefinite)', async () => {
      const repo = makeMockRepo();
      vi.mocked(repo.upsertRetentionPolicy).mockResolvedValueOnce({
        ...basePolicy,
        recording_retention_days: null,
      });
      const service = new RecordingService(repo);
      const policy = await service.updateRetentionPolicy('tenant-1', { recording_retention_days: null });
      expect(policy.recording_retention_days).toBeNull();
    });
  });

  // ── SLICE-47: Legal holds ─────────────────────────────────────────────────

  describe('createLegalHold', () => {
    it('creates a legal hold and returns it with status active', async () => {
      const repo = makeMockRepo();
      const service = new RecordingService(repo);
      const hold = await service.createLegalHold('tenant-1', 'user-1', {
        resource_type: 'recording',
        reason: 'Regulatory requirement',
        case_reference: 'CASE-001',
      });
      expect(hold.status).toBe('active');
      expect(hold.resource_type).toBe('recording');
      expect(repo.createLegalHold).toHaveBeenCalledWith('tenant-1', 'user-1', expect.objectContaining({
        resource_type: 'recording',
        reason: 'Regulatory requirement',
      }));
    });
  });

  describe('listLegalHolds', () => {
    it('returns active holds for tenant', async () => {
      const repo = makeMockRepo();
      const service = new RecordingService(repo);
      const holds = await service.listLegalHolds('tenant-1', { status: 'active' });
      expect(holds).toHaveLength(1);
      expect(repo.listLegalHolds).toHaveBeenCalledWith('tenant-1', { status: 'active' });
    });
  });

  describe('getLegalHold', () => {
    it('returns a specific legal hold', async () => {
      const repo = makeMockRepo();
      const service = new RecordingService(repo);
      const hold = await service.getLegalHold('hold-1', 'tenant-1');
      expect(hold.id).toBe('hold-1');
    });

    it('throws RecordingNotFoundError when hold does not exist', async () => {
      const repo = makeMockRepo();
      vi.mocked(repo.findLegalHold).mockResolvedValueOnce(null);
      const service = new RecordingService(repo);
      await expect(service.getLegalHold('missing', 'tenant-1')).rejects.toBeInstanceOf(RecordingNotFoundError);
    });
  });

  describe('releaseLegalHold', () => {
    it('releases an active hold and returns it with status released', async () => {
      const repo = makeMockRepo();
      const service = new RecordingService(repo);
      const hold = await service.releaseLegalHold('hold-1', 'tenant-1', 'user-1');
      expect(hold.status).toBe('released');
      expect(hold.released_by).toBe('user-1');
    });

    it('throws RecordingNotFoundError when hold not found or already released', async () => {
      const repo = makeMockRepo();
      vi.mocked(repo.releaseLegalHold).mockResolvedValueOnce(null);
      const service = new RecordingService(repo);
      await expect(service.releaseLegalHold('hold-1', 'tenant-1', 'user-1')).rejects.toBeInstanceOf(RecordingNotFoundError);
    });
  });

  describe('hasActiveLegalHold', () => {
    it('returns false when no active hold exists', async () => {
      const repo = makeMockRepo();
      const service = new RecordingService(repo);
      const result = await service.hasActiveLegalHold('tenant-1', 'recording');
      expect(result).toBe(false);
    });

    it('returns true when an active hold blocks the resource type', async () => {
      const repo = makeMockRepo();
      vi.mocked(repo.hasActiveLegalHold).mockResolvedValueOnce(true);
      const service = new RecordingService(repo);
      const result = await service.hasActiveLegalHold('tenant-1', 'recording', 'rec-1');
      expect(result).toBe(true);
    });
  });
});
