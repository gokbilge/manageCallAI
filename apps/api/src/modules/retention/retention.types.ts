export type RetentionPolicy = {
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
};

export type UpdateRetentionPolicyInput = {
  recording_retention_days?: number | null;
  voicemail_retention_days?: number | null;
  transcript_retention_days?: number | null;
  ai_summary_retention_days?: number | null;
  cdr_retention_days?: number | null;
  call_event_retention_days?: number | null;
  generated_media_retention_days?: number | null;
};

export type LegalHoldResourceType =
  | 'recording'
  | 'voicemail'
  | 'transcript'
  | 'summary'
  | 'cdr'
  | 'call_event'
  | 'generated_media'
  | 'all';

export type LegalHold = {
  id: string;
  tenant_id: string;
  resource_type: LegalHoldResourceType;
  resource_id: string | null;
  initiated_by: string;
  case_reference: string | null;
  reason: string;
  status: 'active' | 'released' | 'expired';
  released_by: string | null;
  released_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateLegalHoldInput = {
  resource_type: LegalHoldResourceType;
  resource_id?: string | null;
  initiated_by: string;
  case_reference?: string | null;
  reason: string;
  expires_at?: string | null;
};
