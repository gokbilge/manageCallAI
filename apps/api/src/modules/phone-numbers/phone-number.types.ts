export type PhoneNumberStatus = 'active' | 'inactive';
export type PhoneNumberTargetType = 'inbound_route' | 'flow' | 'extension';

export interface PhoneNumber {
  id: string;
  tenant_id: string;
  e164_number: string;
  display_label: string | null;
  status: PhoneNumberStatus;
  trunk_id: string | null;
  assigned_target_type: PhoneNumberTargetType | null;
  assigned_target_id: string | null;
  created_at: Date;
  updated_at: Date;
}

// HTTP POST body
export interface CreatePhoneNumberBody {
  e164_number: string;
  display_label?: string;
  trunk_id?: string;
}

export type CreatePhoneNumberInput = CreatePhoneNumberBody & { tenant_id: string };

export interface UpdatePhoneNumberInput {
  display_label?: string | null;
  trunk_id?: string | null;
  assigned_target_type?: PhoneNumberTargetType | null;
  assigned_target_id?: string | null;
  status?: PhoneNumberStatus;
}
