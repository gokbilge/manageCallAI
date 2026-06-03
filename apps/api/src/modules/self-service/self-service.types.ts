export interface SelfServicePolicy {
  id: string;
  tenant_id: string;
  voicemail_view: boolean;
  voicemail_pin_change: boolean;
  dnd_manage: boolean;
  call_forward_manage: boolean;
  call_forward_set_target: boolean;
  call_history_view: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ExtensionSelfServiceState {
  id: string;
  extension_number: string;
  display_name: string;
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
}
