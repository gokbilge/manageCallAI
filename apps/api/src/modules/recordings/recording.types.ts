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
