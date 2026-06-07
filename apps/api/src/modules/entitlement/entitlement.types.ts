export type PlanName = 'free' | 'pro' | 'enterprise';

export interface CommercialPlan {
  id: string;
  name: PlanName;
  display_name: string;
  is_default: boolean;
}

export interface PlanEntitlement {
  capability_key: string;
  integer_value: number | null;
  string_value: string | null;
  unit: string | null;
}

export interface TenantSubscription {
  id: string;
  tenant_id: string;
  plan_id: string;
  plan_name: PlanName;
  status: 'active' | 'expired' | 'cancelled';
  started_at: Date;
  expires_at: Date | null;
}

export interface EntitlementOverride {
  capability_key: string;
  integer_value: number | null;
  string_value: string | null;
  expires_at: Date | null;
}

export interface ResolvedEntitlement {
  capability_key: string;
  limit: number | null;       // null = unlimited
  is_contract: boolean;       // true = enterprise contract-defined
  source: 'plan' | 'override';
}

export interface UsageStatus {
  capability_key: string;
  plan: PlanName;
  limit: number | null;
  current: number;
  is_contract: boolean;
  warning_threshold_pct: number;  // 80
  at_warning: boolean;
  at_limit: boolean;
}

export class EntitlementLimitExceededError extends Error {
  constructor(
    public readonly capability: string,
    public readonly plan: PlanName,
    public readonly limit: number,
    public readonly current: number,
  ) {
    super(`Entitlement limit exceeded for ${capability}`);
    this.name = 'EntitlementLimitExceededError';
  }
}
