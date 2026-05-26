export type AuthResponse = {
  token: string;
};

export type RegisterRequest = {
  tenant_name: string;
  tenant_slug: string;
  email: string;
  display_name: string;
  password: string;
};

export type LoginRequest = {
  tenant_slug: string;
  email: string;
  password: string;
};

export type Extension = {
  id: string;
  tenant_id: string;
  extension_number: string;
  display_name: string;
  status: 'active' | 'inactive';
  sip_username: string;
  default_destination_type: string | null;
  default_destination_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateExtensionRequest = {
  extension_number: string;
  display_name: string;
  sip_password: string;
  sip_username?: string;
  default_destination_type?: string;
  default_destination_id?: string;
};

export type CallEvent = {
  id: string;
  tenant_id: string;
  call_id: string;
  event_type: string;
  event_time: string;
  source: string | null;
  payload: Record<string, unknown>;
  ingested_at: string;
};

export type TenantSummary = {
  id: string;
  name: string;
  slug: string;
  directory_domain: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type ServiceHealth = {
  name: string;
  url: string;
  status: 'healthy' | 'degraded' | 'unreachable';
  detail: string;
};

export type RuntimeHealthSummary = {
  services: ServiceHealth[];
};

export type DataEnvelope<T> = {
  data: T;
};

export type RequestOptions = {
  accessToken?: string;
  requestId?: string;
};
