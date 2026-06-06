export interface DispositionCode {
  id: string;
  tenant_id: string;
  code: string;
  label: string;
  description: string | null;
  queue_id: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateDispositionCodeInput {
  tenant_id: string;
  code: string;
  label: string;
  description?: string | null;
  queue_id?: string | null;
}

export interface UpdateDispositionCodeInput {
  label?: string;
  description?: string | null;
  queue_id?: string | null;
  is_active?: boolean;
}

export interface CallDisposition {
  id: string;
  tenant_id: string;
  call_id: string;
  disposition_code_id: string;
  agent_profile_id: string | null;
  recorded_by: string;
  note: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CallDispositionWithCode extends CallDisposition {
  code: string;
  label: string;
}

export interface RecordDispositionInput {
  call_id: string;
  disposition_code_id: string;
  agent_profile_id?: string | null;
  note?: string | null;
}

export interface CallNote {
  id: string;
  tenant_id: string;
  call_id: string;
  author_user_id: string;
  content: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateCallNoteInput {
  call_id: string;
  content: string;
}

export interface UpdateCallNoteInput {
  content: string;
}
