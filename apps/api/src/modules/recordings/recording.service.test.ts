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
      provider_hint: 'auto',
      status: 'queued',
      transcript_status: 'queued',
      summary_status: 'queued',
      processor_id: null,
      claimed_at: null,
      language: null,
      transcript_text: null,
      summary_text: null,
      error_message: null,
      provider_metadata: {},
      metadata: {},
      source_mode: 'deterministic',
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
      provider_hint: 'auto',
      status: 'completed',
      transcript_status: 'completed',
      summary_status: 'completed',
      processor_id: 'processor-1',
      claimed_at: '2026-05-29T10:00:03Z',
      language: 'en',
      transcript_text: 'Transcript',
      summary_text: 'Summary',
      error_message: null,
      provider_metadata: {},
      metadata: {},
      source_mode: 'deterministic',
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

    it('records provider-backed policy metadata when explicit provider-backed analysis is allowed', async () => {
      const repo = makeMockRepo();
      vi.mocked(repo.createAnalysisRequest).mockResolvedValueOnce({
        id: 'analysis-9',
        tenant_id: 'tenant-1',
        recording_id: 'rec-1',
        requested_outputs: ['transcript', 'summary'],
        language_hint: null,
        provider_hint: 'whisper',
        status: 'queued',
        transcript_status: 'queued',
        summary_status: 'queued',
        processor_id: null,
        claimed_at: null,
        language: null,
        transcript_text: null,
        summary_text: null,
        error_message: null,
        provider_metadata: {},
        metadata: { ai_policy: { effective_provider_hint: 'whisper' } },
        source_mode: 'provider_backed',
        created_at: '2026-06-05T10:00:00Z',
        completed_at: null,
      });
      const aiPolicyService = {
        requireProviderBackedAccess: vi.fn().mockResolvedValue({
          requested_provider_hint: 'whisper',
          effective_provider_hint: 'whisper',
          provider_backed_requested: true,
          provider_backed_allowed: true,
          fallback_reason: null,
        }),
      };
      const service = new RecordingService(repo, 'recordings', aiPolicyService as never);

      const result = await service.createAnalysisRequest('rec-1', 'tenant-1', {
        requested_outputs: ['transcript', 'summary'],
        provider_hint: 'whisper',
      });

      expect(result.provider_hint).toBe('whisper');
      expect(result.source_mode).toBe('provider_backed');
      expect(repo.createAnalysisRequest).toHaveBeenCalledWith('rec-1', 'tenant-1', expect.objectContaining({
        provider_hint: 'whisper',
        metadata: expect.objectContaining({
          ai_policy: expect.objectContaining({
            requested_provider_hint: 'whisper',
            effective_provider_hint: 'whisper',
            provider_backed_allowed: true,
          }),
        }),
      }));
    });

    it('checks the parent recording before listing analysis requests', async () => {
      const repo = makeMockRepo();
      const service = new RecordingService(repo);

      await service.listAnalysisRequests('rec-1', 'tenant-1');

      expect(repo.findById).toHaveBeenCalledWith('rec-1', 'tenant-1');
      expect(repo.listAnalysisRequests).toHaveBeenCalledWith('rec-1', 'tenant-1');
    });

    it('rejects unsupported analysis output requests', async () => {
      const repo = makeMockRepo();
      const service = new RecordingService(repo);

      await expect(service.createAnalysisRequest('rec-1', 'tenant-1', {
        requested_outputs: [],
      })).rejects.toThrow('requested_outputs must contain transcript, summary, or both');
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
        provider_hint: 'auto',
        status: 'completed',
        transcript_status: 'completed',
        summary_status: 'completed',
        processor_id: 'processor-1',
        claimed_at: '2026-06-05T08:00:00Z',
        language: 'en',
        transcript_text: 'Transcript',
        summary_text: 'Summary',
        error_message: null,
        provider_metadata: {},
        metadata: {},
        source_mode: 'deterministic',
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

    it('returns unavailable for call review when no linked recording exists', async () => {
      const repo = makeMockRepo();
      vi.mocked(repo.findLatestByCallId).mockResolvedValueOnce(null);
      const service = new RecordingService(repo);

      const review = await service.getSummaryReviewForCall('call-missing', 'tenant-1', {
        canViewTranscript: false,
      });

      expect(review).toMatchObject({
        resource_type: 'call',
        resource_id: 'call-missing',
        status: 'unavailable',
        reason: 'no_linked_recording',
        transcript_access: 'restricted',
      });
    });

    it('returns voicemail review using the linked recording and compliance gate', async () => {
      const repo = makeMockRepo();
      vi.mocked(repo.findLatestByCallId).mockResolvedValueOnce(baseRecording);
      vi.mocked(repo.findLatestAnalysisRequestForRecording).mockResolvedValueOnce({
        id: 'analysis-2',
        tenant_id: 'tenant-1',
        recording_id: 'rec-1',
        requested_outputs: ['summary'],
        language_hint: null,
        provider_hint: 'openai',
        status: 'completed',
        transcript_status: null,
        summary_status: 'completed',
        processor_id: 'processor-2',
        claimed_at: '2026-06-05T09:00:00Z',
        language: 'en',
        transcript_text: 'Transcript hidden',
        summary_text: 'Voicemail summary',
        error_message: null,
        provider_metadata: { source: 'test' },
        metadata: { ai_policy: { effective_provider_hint: 'openai' } },
        source_mode: 'provider_backed',
        created_at: '2026-06-05T09:00:00Z',
        completed_at: '2026-06-05T09:01:00Z',
      });
      const service = new RecordingService(repo);

      const review = await service.getSummaryReviewForVoicemail('vm-1', 'call-abc', 'tenant-1', {
        canViewTranscript: false,
      });

      expect(review).toMatchObject({
        resource_type: 'voicemail',
        resource_id: 'vm-1',
        linked_recording_id: 'rec-1',
        source_mode: 'provider_backed',
        provider_hint: 'openai',
        summary_text: 'Voicemail summary',
        transcript_text: null,
        transcript_access: 'restricted',
      });
    });

    it('returns missing_analysis when no linked analysis request exists', async () => {
      const repo = makeMockRepo();
      vi.mocked(repo.findLatestAnalysisRequestForRecording).mockResolvedValueOnce(null);
      const service = new RecordingService(repo);

      const review = await service.getSummaryReviewForRecording('rec-1', 'tenant-1', {
        canViewTranscript: true,
      });

      expect(review).toMatchObject({
        resource_type: 'recording',
        resource_id: 'rec-1',
        status: 'missing_analysis',
        reason: 'no_analysis_request',
        transcript_access: 'unavailable',
      });
    });

    it('returns summary_retention_elapsed when the summary is outside retention', async () => {
      const repo = makeMockRepo();
      vi.mocked(repo.getRetentionPolicy).mockResolvedValueOnce({
        ...basePolicy,
        ai_summary_retention_days: 1,
      });
      vi.mocked(repo.findLatestAnalysisRequestForRecording).mockResolvedValueOnce({
        id: 'analysis-3',
        tenant_id: 'tenant-1',
        recording_id: 'rec-1',
        requested_outputs: ['summary'],
        language_hint: null,
        provider_hint: 'auto',
        status: 'completed',
        transcript_status: null,
        summary_status: 'completed',
        processor_id: 'processor-3',
        claimed_at: '2026-01-01T00:00:00Z',
        language: 'en',
        transcript_text: null,
        summary_text: 'Expired summary',
        error_message: null,
        provider_metadata: {},
        metadata: {},
        source_mode: 'deterministic',
        created_at: '2026-01-01T00:00:00Z',
        completed_at: '2026-01-01T00:01:00Z',
      });
      const service = new RecordingService(repo);

      const review = await service.getSummaryReviewForRecording('rec-1', 'tenant-1', {
        canViewTranscript: true,
      });

      expect(review).toMatchObject({
        status: 'completed',
        reason: 'summary_retention_elapsed',
        summary_text: null,
      });
    });

    it('returns transcript_retention_elapsed when transcript visibility expires', async () => {
      const repo = makeMockRepo();
      vi.mocked(repo.getRetentionPolicy).mockResolvedValueOnce({
        ...basePolicy,
        ai_summary_retention_days: null,
        transcript_retention_days: 1,
      });
      vi.mocked(repo.findLatestAnalysisRequestForRecording).mockResolvedValueOnce({
        id: 'analysis-4',
        tenant_id: 'tenant-1',
        recording_id: 'rec-1',
        requested_outputs: ['summary', 'transcript'],
        language_hint: null,
        provider_hint: 'auto',
        status: 'completed',
        transcript_status: 'completed',
        summary_status: 'completed',
        processor_id: 'processor-4',
        claimed_at: '2026-01-01T00:00:00Z',
        language: 'en',
        transcript_text: 'Expired transcript',
        summary_text: 'Current summary',
        error_message: null,
        provider_metadata: {},
        metadata: {},
        source_mode: 'deterministic',
        created_at: '2026-01-01T00:00:00Z',
        completed_at: '2026-01-01T00:01:00Z',
      });
      const service = new RecordingService(repo);

      const review = await service.getSummaryReviewForRecording('rec-1', 'tenant-1', {
        canViewTranscript: true,
      });

      expect(review).toMatchObject({
        status: 'completed',
        reason: 'transcript_retention_elapsed',
        summary_text: 'Current summary',
        transcript_text: null,
        transcript_access: 'unavailable',
      });
    });

    it('keeps content available when retention is indefinite', async () => {
      const repo = makeMockRepo();
      vi.mocked(repo.getRetentionPolicy).mockResolvedValueOnce(null);
      const service = new RecordingService(repo);

      const review = await service.getSummaryReviewForRecording('rec-1', 'tenant-1', {
        canViewTranscript: true,
      });

      expect(review).toMatchObject({
        status: 'completed',
        reason: null,
        summary_text: 'Summary',
        transcript_text: 'Transcript',
        transcript_access: 'granted',
      });
    });

    it('returns summary_missing when a completed analysis has no summary or timestamp', async () => {
      const repo = makeMockRepo();
      vi.mocked(repo.findLatestAnalysisRequestForRecording).mockResolvedValueOnce({
        id: 'analysis-5',
        tenant_id: 'tenant-1',
        recording_id: 'rec-1',
        requested_outputs: ['summary'],
        language_hint: null,
        provider_hint: 'auto',
        status: 'completed',
        transcript_status: null,
        summary_status: 'failed',
        processor_id: 'processor-5',
        claimed_at: null,
        language: null,
        transcript_text: null,
        summary_text: null,
        error_message: null,
        provider_metadata: {},
        metadata: {},
        source_mode: 'deterministic',
        created_at: null as unknown as string,
        completed_at: null,
      });
      vi.mocked(repo.getRetentionPolicy).mockResolvedValueOnce({
        ...basePolicy,
        ai_summary_retention_days: 10,
        transcript_retention_days: 10,
      });
      const service = new RecordingService(repo);

      const review = await service.getSummaryReviewForRecording('rec-1', 'tenant-1', {
        canViewTranscript: true,
      });

      expect(review).toMatchObject({
        status: 'completed',
        reason: 'summary_missing',
        summary_text: null,
      });
    });

    it('returns analysis_failed when the provider run fails', async () => {
      const repo = makeMockRepo();
      vi.mocked(repo.findLatestAnalysisRequestForRecording).mockResolvedValueOnce({
        id: 'analysis-6',
        tenant_id: 'tenant-1',
        recording_id: 'rec-1',
        requested_outputs: ['summary'],
        language_hint: null,
        provider_hint: 'openai',
        status: 'failed',
        transcript_status: null,
        summary_status: 'failed',
        processor_id: 'processor-6',
        claimed_at: '2026-06-05T09:00:00Z',
        language: 'en',
        transcript_text: null,
        summary_text: null,
        error_message: 'provider timeout',
        provider_metadata: {},
        metadata: { ai_policy: { effective_provider_hint: 'openai' } },
        source_mode: 'provider_backed',
        created_at: '2026-06-05T09:00:00Z',
        completed_at: '2026-06-05T09:01:00Z',
      });
      const service = new RecordingService(repo);

      const review = await service.getSummaryReviewForRecording('rec-1', 'tenant-1', {
        canViewTranscript: true,
      });

      expect(review).toMatchObject({
        status: 'failed',
        reason: 'analysis_failed',
      });
    });

    it('returns analysis_cancelled when the provider run is cancelled', async () => {
      const repo = makeMockRepo();
      vi.mocked(repo.findLatestAnalysisRequestForRecording).mockResolvedValueOnce({
        id: 'analysis-7',
        tenant_id: 'tenant-1',
        recording_id: 'rec-1',
        requested_outputs: ['summary'],
        language_hint: null,
        provider_hint: 'auto',
        status: 'cancelled',
        transcript_status: null,
        summary_status: 'cancelled',
        processor_id: 'processor-7',
        claimed_at: '2026-06-05T09:00:00Z',
        language: 'en',
        transcript_text: null,
        summary_text: null,
        error_message: null,
        provider_metadata: {},
        metadata: {},
        source_mode: 'deterministic',
        created_at: '2026-06-05T09:00:00Z',
        completed_at: '2026-06-05T09:01:00Z',
      });
      const service = new RecordingService(repo);

      const review = await service.getSummaryReviewForRecording('rec-1', 'tenant-1', {
        canViewTranscript: true,
      });

      expect(review).toMatchObject({
        status: 'cancelled',
        reason: 'analysis_cancelled',
      });
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
