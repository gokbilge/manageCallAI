import { resolve, sep } from 'node:path';
import type {
  ClaimRecordingAnalysisInput,
  CompleteRecordingAnalysisInput,
  CreateLegalHoldInput,
  CreateRecordingAnalysisInput,
  IngestRecordingInput,
  LegalHold,
  LegalHoldListFilter,
  Recording,
  RecordingAnalysisRequest,
  SummaryReview,
  SummaryReviewReason,
  SummaryReviewResourceType,
  TenantRetentionPolicy,
  UpdateRetentionPolicyInput,
} from './recording.types.js';
import type { RecordingRepository } from './recording.repository.js';

export class RecordingNotFoundError extends Error {
  constructor(id: string) {
    super(`Recording not found: ${id}`);
    this.name = 'RecordingNotFoundError';
  }
}

export class RecordingPlaybackPathError extends Error {
  constructor() {
    super('Recording media is not available through the configured storage root');
    this.name = 'RecordingPlaybackPathError';
  }
}

export class RecordingService {
  constructor(
    private readonly repo: RecordingRepository,
    private readonly storageRoot = resolve('recordings'),
  ) {}

  async ingest(input: IngestRecordingInput): Promise<Recording> {
    return this.repo.create(input);
  }

  async listByTenant(tenantId: string, callId?: string): Promise<Recording[]> {
    return this.repo.listByTenant(tenantId, callId);
  }

  async getById(id: string, tenantId: string): Promise<Recording> {
    const recording = await this.repo.findById(id, tenantId);
    if (!recording) throw new RecordingNotFoundError(id);
    return recording;
  }

  async getPlaybackPath(id: string, tenantId: string): Promise<{ recording: Recording; file_path: string }> {
    const recording = await this.getById(id, tenantId);
    if (recording.status !== 'available') throw new RecordingPlaybackPathError();

    const root = resolve(this.storageRoot);
    const candidate = resolve(root, recording.storage_path);
    if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) {
      throw new RecordingPlaybackPathError();
    }

    return { recording, file_path: candidate };
  }

  async createAnalysisRequest(
    recordingId: string,
    tenantId: string,
    input: CreateRecordingAnalysisInput,
  ): Promise<RecordingAnalysisRequest> {
    this.validateRequestedOutputs(input.requested_outputs);
    const request = await this.repo.createAnalysisRequest(recordingId, tenantId, input);
    if (!request) throw new RecordingNotFoundError(recordingId);
    return request;
  }

  async listAnalysisRequests(recordingId: string, tenantId: string): Promise<RecordingAnalysisRequest[]> {
    const recording = await this.repo.findById(recordingId, tenantId);
    if (!recording) throw new RecordingNotFoundError(recordingId);
    return this.repo.listAnalysisRequests(recordingId, tenantId);
  }

  async getAnalysisRequest(id: string, tenantId: string): Promise<RecordingAnalysisRequest> {
    const request = await this.repo.findAnalysisRequest(id, tenantId);
    if (!request) throw new RecordingNotFoundError(id);
    return request;
  }

  async claimAnalysisRequest(id: string, input: ClaimRecordingAnalysisInput): Promise<RecordingAnalysisRequest> {
    const request = await this.repo.claimAnalysisRequest(id, input);
    if (!request) throw new RecordingNotFoundError(id);
    return request;
  }

  async completeAnalysisRequest(id: string, input: CompleteRecordingAnalysisInput): Promise<RecordingAnalysisRequest> {
    const request = await this.repo.completeAnalysisRequest(id, input);
    if (!request) throw new RecordingNotFoundError(id);
    return request;
  }

  async getSummaryReviewForRecording(
    recordingId: string,
    tenantId: string,
    options: { canViewTranscript: boolean },
  ): Promise<SummaryReview> {
    const recording = await this.getById(recordingId, tenantId);
    return this.buildSummaryReview('recording', recording.id, recording.call_id, recording, options);
  }

  async getSummaryReviewForCall(
    callId: string,
    tenantId: string,
    options: { canViewTranscript: boolean },
  ): Promise<SummaryReview> {
    const recording = await this.repo.findLatestByCallId(callId, tenantId);
    if (!recording) {
      return this.buildUnavailableReview('call', callId, callId, options.canViewTranscript);
    }
    return this.buildSummaryReview('call', callId, callId, recording, options);
  }

  async getSummaryReviewForVoicemail(
    voicemailMessageId: string,
    callId: string,
    tenantId: string,
    options: { canViewTranscript: boolean },
  ): Promise<SummaryReview> {
    const recording = await this.repo.findLatestByCallId(callId, tenantId);
    if (!recording) {
      return this.buildUnavailableReview('voicemail', voicemailMessageId, callId, options.canViewTranscript);
    }
    return this.buildSummaryReview('voicemail', voicemailMessageId, callId, recording, options);
  }

  private validateRequestedOutputs(outputs: string[]): void {
    const allowed = new Set(['transcript', 'summary']);
    if (outputs.length === 0 || outputs.some((output) => !allowed.has(output))) {
      throw new Error('requested_outputs must contain transcript, summary, or both');
    }
  }

  private buildUnavailableReview(
    resourceType: SummaryReviewResourceType,
    resourceId: string,
    callId: string,
    canViewTranscript: boolean,
  ): SummaryReview {
    return this.normalizeSummaryReview({
      resource_type: resourceType,
      resource_id: resourceId,
      call_id: callId,
      linked_recording_id: null,
      analysis_request_id: null,
      status: 'unavailable',
      reason: 'no_linked_recording',
      summary_text: null,
      transcript_text: null,
      transcript_access: canViewTranscript ? 'unavailable' : 'restricted',
      can_view_transcript: canViewTranscript,
      language: null,
      requested_outputs: [],
      completed_at: null,
      provider_metadata: {},
    });
  }

  private async buildSummaryReview(
    resourceType: SummaryReviewResourceType,
    resourceId: string,
    callId: string,
    recording: Recording,
    options: { canViewTranscript: boolean },
  ): Promise<SummaryReview> {
    const [analysis, policy] = await Promise.all([
      this.repo.findLatestAnalysisRequestForRecording(recording.id, recording.tenant_id),
      this.repo.getRetentionPolicy(recording.tenant_id),
    ]);

    if (!analysis) {
      return this.normalizeSummaryReview({
        resource_type: resourceType,
        resource_id: resourceId,
        call_id: callId,
        linked_recording_id: recording.id,
        analysis_request_id: null,
        status: 'missing_analysis',
        reason: 'no_analysis_request',
        summary_text: null,
        transcript_text: null,
        transcript_access: options.canViewTranscript ? 'unavailable' : 'restricted',
        can_view_transcript: options.canViewTranscript,
        language: null,
        requested_outputs: [],
        completed_at: null,
        provider_metadata: {},
      });
    }

    const [summaryHeld, transcriptHeld] = await Promise.all([
      this.hasRetentionOverride(recording.tenant_id, resourceType, resourceId, 'summary', analysis.id, recording.id),
      this.hasRetentionOverride(recording.tenant_id, resourceType, resourceId, 'transcript', analysis.id, recording.id),
    ]);

    const summaryAvailable = this.isWithinRetentionWindow(
      analysis.completed_at ?? analysis.created_at,
      policy?.ai_summary_retention_days ?? null,
      summaryHeld,
    );
    const transcriptAvailable = this.isWithinRetentionWindow(
      analysis.completed_at ?? analysis.created_at,
      policy?.transcript_retention_days ?? null,
      transcriptHeld,
    );

    const summaryText = analysis.summary_text && summaryAvailable ? analysis.summary_text : null;
    const transcriptText = options.canViewTranscript && analysis.transcript_text && transcriptAvailable
      ? analysis.transcript_text
      : null;

    let reason: SummaryReviewReason | null = null;
    if (analysis.status === 'failed') {
      reason = 'analysis_failed';
    } else if (analysis.status === 'cancelled') {
      reason = 'analysis_cancelled';
    } else if (analysis.status === 'completed' && !summaryText) {
      reason = analysis.summary_text ? 'summary_retention_elapsed' : 'summary_missing';
    } else if (analysis.status === 'completed' && options.canViewTranscript && analysis.transcript_text && !transcriptText) {
      reason = 'transcript_retention_elapsed';
    }

    return this.normalizeSummaryReview({
      resource_type: resourceType,
      resource_id: resourceId,
      call_id: callId,
      linked_recording_id: recording.id,
      analysis_request_id: analysis.id,
      status: analysis.status,
      reason,
      summary_text: summaryText,
      transcript_text: transcriptText,
      transcript_access: options.canViewTranscript
        ? (analysis.transcript_text ? (transcriptAvailable ? 'granted' : 'unavailable') : 'unavailable')
        : 'restricted',
      can_view_transcript: options.canViewTranscript,
      language: analysis.language,
      requested_outputs: [...analysis.requested_outputs],
      completed_at: analysis.completed_at,
      provider_metadata: analysis.provider_metadata,
    });
  }

  private normalizeSummaryReview(review: SummaryReview): SummaryReview {
    return {
      ...review,
      language: review.language ?? null,
      requested_outputs: [...review.requested_outputs],
      completed_at: review.completed_at ? new Date(review.completed_at).toISOString() : null,
      provider_metadata: review.provider_metadata ?? {},
    };
  }

  private isWithinRetentionWindow(referenceAt: string | null, retentionDays: number | null, held: boolean): boolean {
    if (held || retentionDays === null) {
      return true;
    }
    if (!referenceAt) {
      return false;
    }
    const cutoff = new Date(referenceAt).getTime() + (retentionDays * 24 * 60 * 60 * 1000);
    return Date.now() <= cutoff;
  }

  private async hasRetentionOverride(
    tenantId: string,
    resourceType: SummaryReviewResourceType,
    resourceId: string,
    childResourceType: 'summary' | 'transcript',
    childResourceId: string,
    recordingId: string,
  ): Promise<boolean> {
    const checks = [
      this.repo.hasActiveLegalHold(tenantId, childResourceType, childResourceId),
      this.repo.hasActiveLegalHold(tenantId, 'recording', recordingId),
    ];
    if (resourceType === 'voicemail') {
      checks.push(this.repo.hasActiveLegalHold(tenantId, 'voicemail', resourceId));
    }
    return (await Promise.all(checks)).some(Boolean);
  }

  async getRetentionPolicy(tenantId: string): Promise<TenantRetentionPolicy | null> {
    return this.repo.getRetentionPolicy(tenantId);
  }

  async updateRetentionPolicy(tenantId: string, input: UpdateRetentionPolicyInput): Promise<TenantRetentionPolicy> {
    return this.repo.upsertRetentionPolicy(tenantId, input);
  }

  async createLegalHold(tenantId: string, initiatedBy: string, input: CreateLegalHoldInput): Promise<LegalHold> {
    return this.repo.createLegalHold(tenantId, initiatedBy, input);
  }

  async listLegalHolds(tenantId: string, filter: LegalHoldListFilter): Promise<LegalHold[]> {
    return this.repo.listLegalHolds(tenantId, filter);
  }

  async getLegalHold(id: string, tenantId: string): Promise<LegalHold> {
    const hold = await this.repo.findLegalHold(id, tenantId);
    if (!hold) throw new RecordingNotFoundError(id);
    return hold;
  }

  async releaseLegalHold(id: string, tenantId: string, releasedBy: string): Promise<LegalHold> {
    const hold = await this.repo.releaseLegalHold(id, tenantId, releasedBy);
    if (!hold) throw new RecordingNotFoundError(id);
    return hold;
  }

  async hasActiveLegalHold(tenantId: string, resourceType: string, resourceId?: string): Promise<boolean> {
    return this.repo.hasActiveLegalHold(tenantId, resourceType, resourceId);
  }
}
