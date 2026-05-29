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
