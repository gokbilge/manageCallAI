export type DeviceType = 'softphone' | 'desk_phone' | 'webrtc' | 'mobile' | 'other';
export type DeviceStatus = 'active' | 'inactive' | 'deprovisioned';

export interface Device {
  id: string;
  tenant_id: string;
  name: string;
  device_type: DeviceType;
  mac_address: string | null;
  sip_username: string | null;
  status: DeviceStatus;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface DeviceRegistration {
  id: string;
  tenant_id: string;
  device_id: string | null;
  extension_id: string | null;
  sip_username: string;
  registered_at: Date;
  expires_at: Date | null;
  contact_uri: string | null;
  user_agent: string | null;
  source_ip: string | null;
  is_active: boolean;
}

export interface ExtensionAssignment {
  id: string;
  tenant_id: string;
  extension_id: string;
  assignable_type: 'user' | 'device';
  assignable_id: string;
  is_primary: boolean;
  created_at: Date;
}

export interface ExtensionAssignmentSummary {
  extension_id: string;
  users: ExtensionAssignment[];
  devices: ExtensionAssignment[];
}

export interface CreateDeviceInput {
  name: string;
  device_type?: DeviceType;
  mac_address?: string;
  sip_username?: string;
  sip_password?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateDeviceInput {
  name?: string;
  device_type?: DeviceType;
  mac_address?: string | null;
  sip_username?: string | null;
  sip_password?: string;
  status?: DeviceStatus;
  metadata?: Record<string, unknown>;
}

export interface RecordRegistrationInput {
  device_id?: string | null;
  extension_id?: string | null;
  sip_username: string;
  expires_at?: string | null;
  contact_uri?: string | null;
  user_agent?: string | null;
  source_ip?: string | null;
}

export interface AssignInput {
  extension_id: string;
  assignable_type: 'user' | 'device';
  assignable_id: string;
  is_primary?: boolean;
}
