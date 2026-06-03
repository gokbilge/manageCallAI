export interface NodeStatusSnapshot {
  node_id: string;
  queried_at: Date;
  freeswitch_version: string | null;
  loaded_modules: string[];
  missing_required_modules: string[];
  sofia_profiles: Record<string, SofiaProfileStatus>;
  gateway_statuses: Record<string, GatewayStatus>;
  active_channel_count: number | null;
  active_registration_count: number | null;
}

export interface SofiaProfileStatus {
  state: string;
}

export interface GatewayStatus {
  state: string;
  ping_ms?: number | null;
}

export interface UpsertNodeStatusInput {
  node_id: string;
  freeswitch_version?: string | null;
  loaded_modules?: string[];
  missing_required_modules?: string[];
  sofia_profiles?: Record<string, SofiaProfileStatus>;
  gateway_statuses?: Record<string, GatewayStatus>;
  active_channel_count?: number | null;
  active_registration_count?: number | null;
}
