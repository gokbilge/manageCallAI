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
import type { AiPolicyService } from '../ai-policy/ai-policy.service.js';
import type { IntegrationProvider } from '../provider-work/provider-work.types.js';

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
    private readonly aiPolicyService?: AiPolicyService,
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
    const resolved = await this.resolveProvider(tenantId, input.provider_hint, input.requested_outputs);
    const request = await this.repo.createAnalysisRequest(recordingId, tenantId, {
      ...input,
      provider_hint: resolved.effective_provider_hint,
      metadata: {
        ...(input.metadata ?? {}),
        ai_policy: {
          requested_provider_hint: resolved.requested_provider_hint,
          effective_provider_hint: resolved.effective_provider_hint,
          provider_backed_requested: resolved.provider_backed_requested,
          provider_backed_allowed: resolved.provider_backed_allowed,
          fallback_reason: resolved.fallback_reason,
        },
      },
    });
    if (!request) throw new RecordingNotFoundError(recordingId);
    return this.normalizeAnalysisRequest(request);
  }

  async listAnalysisRequests(recordingId: string, tenantId: string): Promise<RecordingAnalysisRequest[]> {
    const recording = await this.repo.findById(recordingId, tenantId);
    if (!recording) throw new RecordingNotFoundError(recordingId);
    const requests = await this.repo.listAnalysisRequests(recordingId, tenantId);
    return requests.map((request) => this.normalizeAnalysisRequest(request));
  }

  async getAnalysisRequest(id: string, tenantId: string): Promise<RecordingAnalysisRequest> {
    const request = await this.repo.findAnalysisRequest(id, tenantId);
    if (!request) throw new RecordingNotFoundError(id);
    return this.normalizeAnalysisRequest(request);
  }

  async claimAnalysisRequest(id: string, input: ClaimRecordingAnalysisInput): Promise<RecordingAnalysisRequest> {
    const request = await this.repo.claimAnalysisRequest(id, input);
    if (!request) throw new RecordingNotFoundError(id);
    return this.normalizeAnalysisRequest(request);
  }

  async completeAnalysisRequest(id: string, input: CompleteRecordingAnalysisInput): Promise<RecordingAnalysisRequest> {
    const request = await this.repo.completeAnalysisRequest(id, input);
    if (!request) throw new RecordingNotFoundError(id);
    return this.normalizeAnalysisRequest(request);
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
      transcript_status: null,
      summary_status: null,
      source_mode: 'deterministic',
      provider_hint: 'auto',
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
        transcript_status: null,
        summary_status: null,
        source_mode: 'deterministic',
        provider_hint: 'auto',
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
    const normalizedAnalysis = this.normalizeAnalysisRequest(analysis);

    const [summaryHeld, transcriptHeld] = await Promise.all([
      this.hasRetentionOverride(recording.tenant_id, resourceType, resourceId, 'summary', normalizedAnalysis.id, recording.id),
      this.hasRetentionOverride(recording.tenant_id, resourceType, resourceId, 'transcript', normalizedAnalysis.id, recording.id),
    ]);

    const summaryAvailable = this.isWithinRetentionWindow(
      normalizedAnalysis.completed_at ?? normalizedAnalysis.created_at,
      policy?.ai_summary_retention_days ?? null,
      summaryHeld,
    );
    const transcriptAvailable = this.isWithinRetentionWindow(
      normalizedAnalysis.completed_at ?? normalizedAnalysis.created_at,
      policy?.transcript_retention_days ?? null,
      transcriptHeld,
    );

    const summaryText = normalizedAnalysis.summary_text && summaryAvailable ? normalizedAnalysis.summary_text : null;
    const transcriptText = options.canViewTranscript && normalizedAnalysis.transcript_text && transcriptAvailable
      ? normalizedAnalysis.transcript_text
      : null;

    let reason: SummaryReviewReason | null = null;
    if (normalizedAnalysis.status === 'failed') {
      reason = 'analysis_failed';
    } else if (normalizedAnalysis.status === 'cancelled') {
      reason = 'analysis_cancelled';
    } else if (normalizedAnalysis.status === 'completed' && !summaryText) {
      reason = normalizedAnalysis.summary_text ? 'summary_retention_elapsed' : 'summary_missing';
    } else if (normalizedAnalysis.status === 'completed' && options.canViewTranscript && normalizedAnalysis.transcript_text && !transcriptText) {
      reason = 'transcript_retention_elapsed';
    }

    return this.normalizeSummaryReview({
      resource_type: resourceType,
      resource_id: resourceId,
      call_id: callId,
      linked_recording_id: recording.id,
      analysis_request_id: normalizedAnalysis.id,
      status: normalizedAnalysis.status,
      transcript_status: normalizedAnalysis.transcript_status,
      summary_status: normalizedAnalysis.summary_status,
      source_mode: normalizedAnalysis.source_mode,
      provider_hint: normalizedAnalysis.provider_hint,
      reason,
      summary_text: summaryText,
      transcript_text: transcriptText,
      transcript_access: options.canViewTranscript
        ? (normalizedAnalysis.transcript_text ? (transcriptAvailable ? 'granted' : 'unavailable') : 'unavailable')
        : 'restricted',
      can_view_transcript: options.canViewTranscript,
      language: normalizedAnalysis.language,
      requested_outputs: [...normalizedAnalysis.requested_outputs],
      completed_at: normalizedAnalysis.completed_at,
      provider_metadata: normalizedAnalysis.provider_metadata,
    });
  }

  private normalizeAnalysisRequest(request: RecordingAnalysisRequest): RecordingAnalysisRequest {
    return {
      ...request,
      provider_hint: request.provider_hint ?? 'auto',
      transcript_status: request.transcript_status ?? null,
      summary_status: request.summary_status ?? null,
      source_mode: resolveSourceMode(request.provider_hint, request.metadata),
      claimed_at: request.claimed_at ? new Date(request.claimed_at).toISOString() : null,
      completed_at: request.completed_at ? new Date(request.completed_at).toISOString() : null,
      created_at: new Date(request.created_at).toISOString(),
      provider_metadata: request.provider_metadata ?? {},
      metadata: request.metadata ?? {},
      requested_outputs: [...request.requested_outputs],
    };
  }

  private normalizeSummaryReview(review: SummaryReview): SummaryReview {
    return {
      ...review,
      language: review.language ?? null,
      transcript_status: review.transcript_status ?? null,
      summary_status: review.summary_status ?? null,
      source_mode: review.source_mode ?? 'deterministic',
      provider_hint: review.provider_hint ?? 'auto',
      requested_outputs: [...review.requested_outputs],
      completed_at: review.completed_at ? new Date(review.completed_at).toISOString() : null,
      provider_metadata: review.provider_metadata ?? {},
    };
  }

  private async resolveProvider(
    tenantId: string,
    providerHint: IntegrationProvider | undefined,
    requestedOutputs: string[],
  ) {
    if (!this.aiPolicyService) {
      return {
        requested_provider_hint: providerHint ?? 'auto',
        effective_provider_hint: providerHint ?? 'auto',
        provider_backed_requested: (providerHint ?? 'auto') !== 'auto',
        provider_backed_allowed: (providerHint ?? 'auto') !== 'auto',
        fallback_reason: providerHint ? null : 'requested_auto',
      };
    }
    return this.aiPolicyService.requireProviderBackedAccess({
      tenant_id: tenantId,
      feature: 'recording_analysis',
      requested_provider_hint: providerHint ?? 'auto',
      input_text: requestedOutputs.join(','),
    });
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

function resolveSourceMode(
  providerHint: IntegrationProvider | undefined,
  metadata: Record<string, unknown> | undefined,
): 'deterministic' | 'provider_backed' {
  const aiPolicy = metadata?.['ai_policy'];
  if (typeof aiPolicy === 'object' && aiPolicy !== null) {
    const effectiveProvider = (aiPolicy as { effective_provider_hint?: unknown }).effective_provider_hint;
    if (typeof effectiveProvider === 'string' && effectiveProvider !== 'auto') {
      return 'provider_backed';
    }
  }
  return providerHint && providerHint !== 'auto' ? 'provider_backed' : 'deterministic';
}
