export interface InvestigationCitation {
  source: 'call_event' | 'inbound_route' | 'outbound_route' | 'sip_trunk' | 'recording' | 'gateway_status';
  id: string;
  label: string;
  fact: string;
}

export interface InvestigationContext {
  call_ids?: string[];
  route_ids?: string[];
  time_range?: { from: string; to: string };
}

export interface IncidentInvestigation {
  id: string;
  tenant_id: string;
  question: string;
  context: InvestigationContext;
  answer: string | null;
  citations: InvestigationCitation[];
  data_sources: string[];
  is_advisory: true;
  created_by: string | null;
  created_at: string;
}

export interface CallEventRow {
  call_id: string;
  event_type: string;
  event_time: Date;
  source: string | null;
  payload: Record<string, unknown>;
}

export interface RouteRow {
  id: string;
  name: string;
  status: string;
  match_value?: string;
  match_type?: string;
  target_type?: string;
  target_id?: string | null;
  match_prefix?: string;
  priority?: number;
}

export interface GatewayStatusRow {
  gateway_name: string;
  state: string;
  ping_time_ms: number | null;
  updated_at: Date;
}
