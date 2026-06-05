export interface SelfServicePolicy {
  id: string;
  tenant_id: string;
  voicemail_view: boolean;
  voicemail_pin_change: boolean;
  dnd_manage: boolean;
  call_forward_manage: boolean;
  call_forward_set_target: boolean;
  call_history_view: boolean;
  device_view: boolean;
  sip_credential_reset: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ExtensionSelfServiceState {
  id: string;
  extension_number: string;
  display_name: string;
  sip_username: string;
  dnd_enabled: boolean;
  call_forward_enabled: boolean;
  call_forward_target: string | null;
}

export interface UpdateSelfServicePolicyInput {
  voicemail_view?: boolean;
  voicemail_pin_change?: boolean;
  dnd_manage?: boolean;
  call_forward_manage?: boolean;
  call_forward_set_target?: boolean;
  call_history_view?: boolean;
  device_view?: boolean;
  sip_credential_reset?: boolean;
}

export interface SelfServiceVoicemailMessage {
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

export interface SelfServiceCallEvent {
  id: string;
  tenant_id: string;
  call_id: string;
  event_type: string;
  event_time: Date;
  source: string | null;
  payload: Record<string, unknown>;
  ingested_at: Date;
}

export interface SelfServiceDeviceRegistration {
  id: string;
  tenant_id: string;
  extension_id: string | null;
  extension_number: string;
  status: 'registered' | 'expired' | 'unregistered';
  contact_domain: string | null;
  user_agent: string | null;
  registered_at: Date | null;
  last_seen_at: Date | null;
  updated_at: Date;
}

export interface ResetSipCredentialResult {
  extension_id: string;
  extension_number: string;
  sip_username: string;
  sip_password: string;
}

export interface RevokeDeviceResult {
  id: string;
  revoked: true;
}
