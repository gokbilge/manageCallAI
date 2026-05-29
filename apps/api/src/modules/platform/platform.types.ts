export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  directory_domain: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface ServiceHealth {
  name: string;
  url: string;
  status: 'healthy' | 'degraded' | 'unreachable';
  detail: string;
}

export interface RuntimeHealthSummary {
  services: ServiceHealth[];
}

export interface PlatformRuntimeSummary {
  active_sessions: number;
  completed_sessions_24h: number;
  failed_sessions_24h: number;
  call_events_24h: number;
  failed_runtime_ingestions_24h: number;
  pending_approvals: number;
}
