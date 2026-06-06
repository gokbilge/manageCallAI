export type AiRecommendationTargetType = 'inbound_route' | 'outbound_route' | 'fraud_policy';
export type AiRecommendationStatus = 'pending' | 'accepted' | 'rejected';
export type AiRecommendationRiskLevel = 'low' | 'medium' | 'high';

export interface RouteRecommendationChanges {
  target_type?: string;
  target_id?: string | null;
  match_type?: string;
  match_value?: string;
  priority?: number;
  sip_trunk_id?: string;
  fallback_sip_trunk_id?: string | null;
  [key: string]: unknown;
}

export interface FraudPolicyRecommendationChanges {
  country_allowlist?: string[];
  areacode_allowlist?: string[];
  premium_rate_blocklist?: string[];
  high_risk_blocklist?: string[];
  max_calls_per_hour?: number | null;
  max_calls_per_day?: number | null;
  max_call_duration_secs?: number | null;
  deny_international_default?: boolean;
}

export interface AffectedRoute {
  id: string;
  name: string;
  status: string;
  role: string;
}

export interface RouteRecommendationDetail {
  type: 'inbound_route' | 'outbound_route';
  suggested_changes: RouteRecommendationChanges;
  affected_numbers: string[];
  affected_routes: AffectedRoute[];
}

export interface FraudPolicyRecommendationDetail {
  type: 'fraud_policy';
  suggested_changes: FraudPolicyRecommendationChanges;
}

export type RecommendationDetail = RouteRecommendationDetail | FraudPolicyRecommendationDetail;

export interface AiRecommendation {
  id: string;
  tenant_id: string;
  target_type: AiRecommendationTargetType;
  target_id: string | null;
  intent: string;
  status: AiRecommendationStatus;
  recommendation: RecommendationDetail | null;
  risk_level: AiRecommendationRiskLevel | null;
  rationale: string | null;
  blast_radius: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  decided_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CreateRecommendationInput {
  target_type: AiRecommendationTargetType;
  target_id?: string | null;
  intent: string;
  metadata?: Record<string, unknown>;
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

export interface PhoneNumberRow {
  id: string;
  number: string;
  status: string;
}

export interface TenantPolicyRow {
  country_allowlist: string[];
  areacode_allowlist: string[];
  premium_rate_blocklist: string[];
  high_risk_blocklist: string[];
  max_calls_per_hour: number | null;
  max_calls_per_day: number | null;
  max_call_duration_secs: number | null;
  deny_international_default: boolean;
}
