export type VoicemailBoxStatus = 'active' | 'inactive';

export interface VoicemailBox {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  mailbox_number: string;
  greeting_prompt_id: string | null;
  greeting_prompt_name: string | null;
  greeting_prompt_uri: string | null;
  status: VoicemailBoxStatus;
  created_at: Date;
  updated_at: Date;
}

export interface CreateVoicemailBoxInput {
  tenant_id: string;
  name: string;
  description?: string;
  mailbox_number: string;
  greeting_prompt_id?: string | null;
}

export interface UpdateVoicemailBoxInput {
  name?: string;
  description?: string | null;
  mailbox_number?: string;
  greeting_prompt_id?: string | null;
  status?: VoicemailBoxStatus;
}
