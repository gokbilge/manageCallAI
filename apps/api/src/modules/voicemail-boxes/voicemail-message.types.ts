export interface VoicemailMessage {
  id: string;
  tenant_id: string;
  voicemail_box_id: string;
  call_id: string;
  storage_path: string;
  duration_secs: number | null;
  size_bytes: number | null;
  read_at: Date | null;
  deleted_at: Date | null;
  recorded_at: Date;
  created_at: Date;
}

export interface CreateVoicemailMessageInput {
  tenant_id: string;
  voicemail_box_id: string;
  call_id: string;
  storage_path: string;
  duration_secs?: number;
  size_bytes?: number;
}
