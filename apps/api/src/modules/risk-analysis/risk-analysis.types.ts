export type RiskTargetType = 'outbound_route' | 'inbound_route' | 'sip_trunk';
export type RiskLevel = 'low' | 'medium' | 'high';
export type RiskConcernSeverity = 'info' | 'warning' | 'error';

export interface RiskConcern {
  code: string;
  severity: RiskConcernSeverity;
  message: string;
}

export interface AffectedObject {
  type: string;
  id: string;
  name: string;
  role: string;
}

export interface RouteRiskAnalysis {
  target_type: RiskTargetType;
  target_id: string;
  target_name: string;
  target_status: string;
  risk_level: RiskLevel;
  affected_objects: AffectedObject[];
  unresolved_concerns: RiskConcern[];
  summary: string;
  is_advisory: true;
  analyzed_at: string;
}

export interface OutboundRouteRow {
  id: string;
  name: string;
  status: string;
  match_prefix: string;
  priority: number;
  sip_trunk_id: string;
  fallback_sip_trunk_id: string | null;
  max_calls_per_minute: number | null;
}

export interface InboundRouteRow {
  id: string;
  name: string;
  status: string;
  match_type: string;
  match_value: string;
  phone_number_id: string | null;
  target_type: string;
  target_id: string | null;
  draft_version_id: string | null;
  active_version_id: string | null;
}

export interface RouteVersionRow {
  id: string;
  state: string;
  version_number: number;
}

export interface SipTrunkRow {
  id: string;
  name: string;
  status: string;
  direction: string;
}

export interface DependentRouteRow {
  id: string;
  name: string;
  status: string;
  role: 'primary' | 'fallback';
}
