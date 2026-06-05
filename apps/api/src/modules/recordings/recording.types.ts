export type RecordingStatus = 'pending' | 'available' | 'deleted';

export interface Recording {
  id: string;
  tenant_id: string;
  call_id: string;
  call_event_id: string | null;
  storage_path: string;
  duration_secs: number | null;
  size_bytes: number | null;
  status: RecordingStatus;
  recorded_at: string;
  created_at: string;
}

export interface IngestRecordingInput {
  tenant_id: string;
  call_id: string;
  call_event_id?: string | null;
  storage_path: string;
  duration_secs?: number | null;
  size_bytes?: number | null;
  recorded_at?: string | null;
}

export type RecordingAnalysisStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type RecordingAnalysisOutput = 'transcript' | 'summary';

export interface RecordingAnalysisRequest {
  id: string;
  tenant_id: string;
  recording_id: string;
  requested_outputs: RecordingAnalysisOutput[];
  language_hint: string | null;
  status: RecordingAnalysisStatus;
  processor_id: string | null;
  claimed_at: string | null;
  language: string | null;
  transcript_text: string | null;
  summary_text: string | null;
  error_message: string | null;
  provider_metadata: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  completed_at: string | null;
}

export interface CreateRecordingAnalysisInput {
  requested_outputs: RecordingAnalysisOutput[];
  language_hint?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ClaimRecordingAnalysisInput {
  processor_id?: string | null;
}

export interface CompleteRecordingAnalysisInput {
  status: 'completed' | 'failed';
  language?: string | null;
  transcript_text?: string | null;
  summary_text?: string | null;
  error_message?: string | null;
  provider_metadata?: Record<string, unknown>;
}

export type SummaryReviewResourceType = 'call' | 'recording' | 'voicemail';
export type SummaryReviewStatus =
  | 'missing_analysis'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'unavailable';
export type SummaryReviewReason =
  | 'no_linked_recording'
  | 'no_analysis_request'
  | 'summary_missing'
  | 'summary_retention_elapsed'
  | 'transcript_retention_elapsed'
  | 'analysis_failed'
  | 'analysis_cancelled';

export interface SummaryReview {
  resource_type: SummaryReviewResourceType;
  resource_id: string;
  call_id: string;
  linked_recording_id: string | null;
  analysis_request_id: string | null;
  status: SummaryReviewStatus;
  reason: SummaryReviewReason | null;
  summary_text: string | null;
  transcript_text: string | null;
  transcript_access: 'granted' | 'restricted' | 'unavailable';
  can_view_transcript: boolean;
  language: string | null;
  requested_outputs: RecordingAnalysisOutput[];
  completed_at: string | null;
  provider_metadata: Record<string, unknown>;
}

// ── SLICE-47: Retention and privacy ──────────────────────────────────────────

export interface TenantRetentionPolicy {
  id: string;
  tenant_id: string;
  recording_retention_days: number | null;
  voicemail_retention_days: number | null;
  transcript_retention_days: number | null;
  ai_summary_retention_days: number | null;
  cdr_retention_days: number | null;
  call_event_retention_days: number | null;
  generated_media_retention_days: number | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateRetentionPolicyInput {
  recording_retention_days?: number | null;
  voicemail_retention_days?: number | null;
  transcript_retention_days?: number | null;
  ai_summary_retention_days?: number | null;
  cdr_retention_days?: number | null;
  call_event_retention_days?: number | null;
  generated_media_retention_days?: number | null;
}

export type LegalHoldStatus = 'active' | 'released' | 'expired';
export type LegalHoldResourceType =
  | 'recording'
  | 'voicemail'
  | 'transcript'
  | 'summary'
  | 'cdr'
  | 'call_event'
  | 'generated_media'
  | 'all';

export interface LegalHold {
  id: string;
  tenant_id: string;
  resource_type: LegalHoldResourceType;
  resource_id: string | null;
  initiated_by: string;
  case_reference: string | null;
  reason: string;
  status: LegalHoldStatus;
  released_by: string | null;
  released_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateLegalHoldInput {
  resource_type: LegalHoldResourceType;
  resource_id?: string | null;
  case_reference?: string | null;
  reason: string;
  expires_at?: string | null;
}

export interface LegalHoldListFilter {
  resource_type?: LegalHoldResourceType;
  status?: LegalHoldStatus;
}
