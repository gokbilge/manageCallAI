// SLICE-45: Tenant outbound fraud policy types

export interface TenantOutboundPolicy {
  id: string;
  tenant_id: string;
  country_allowlist: string[];
  areacode_allowlist: string[];
  premium_rate_blocklist: string[];
  high_risk_blocklist: string[];
  max_calls_per_hour: number | null;
  max_calls_per_day: number | null;
  max_call_duration_secs: number | null;
  deny_international_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpdateTenantOutboundPolicyInput {
  country_allowlist?: string[];
  areacode_allowlist?: string[];
  premium_rate_blocklist?: string[];
  high_risk_blocklist?: string[];
  max_calls_per_hour?: number | null;
  max_calls_per_day?: number | null;
  max_call_duration_secs?: number | null;
  deny_international_default?: boolean;
}

export type FraudBlockReason =
  | 'global_emergency_block'
  | 'global_premium_rate_block'
  | 'tenant_premium_rate_block'
  | 'tenant_high_risk_block'
  | 'tenant_country_not_allowed'
  | 'tenant_areacode_not_allowed'
  | 'tenant_hourly_limit_exceeded'
  | 'tenant_daily_limit_exceeded';

export interface FraudCheckResult {
  allowed: boolean;
  reason?: FraudBlockReason;
}
