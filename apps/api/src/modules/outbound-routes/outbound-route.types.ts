export type OutboundRoute = {
  id: string;
  tenant_id: string;
  name: string;
  status: 'active' | 'inactive';
  match_prefix: string;
  priority: number;
  sip_trunk_id: string;
  fallback_sip_trunk_id: string | null;
  max_calls_per_minute: number | null;
  allowed_caller_id_numbers_json: string[] | null;
  allowed_destination_prefixes_json: string[] | null;
  blocked_destination_prefixes_json: string[] | null;
  created_at: Date;
  updated_at: Date;
};

export type CreateOutboundRouteInput = {
  tenant_id: string;
  name: string;
  match_prefix: string;
  priority?: number;
  sip_trunk_id: string;
  fallback_sip_trunk_id?: string | null;
  max_calls_per_minute?: number | null;
  allowed_caller_id_numbers_json?: string[] | null;
  allowed_destination_prefixes_json?: string[] | null;
  blocked_destination_prefixes_json?: string[] | null;
};

export type UpdateOutboundRouteInput = {
  name?: string;
  match_prefix?: string;
  priority?: number;
  sip_trunk_id?: string;
  fallback_sip_trunk_id?: string | null;
  max_calls_per_minute?: number | null;
  allowed_caller_id_numbers_json?: string[] | null;
  allowed_destination_prefixes_json?: string[] | null;
  blocked_destination_prefixes_json?: string[] | null;
  status?: 'active' | 'inactive';
};

export type ResolvedOutboundRoute = {
  route_id: string;
  sip_trunk_id: string;
  fallback_sip_trunk_id: string | null;
  match_prefix: string;
  priority: number;
  allowed_destination_prefixes_json: string[] | null;
  blocked_destination_prefixes_json: string[] | null;
};
