export type CallingPolicyStatus = 'active' | 'inactive';
export type PolicyAssignableType = 'extension' | 'call_group' | 'tenant';

export interface PolicyException {
  type: 'allow' | 'block';
  prefix: string;
  reason?: string;
}

export interface CallingPolicy {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  allow_local: boolean;
  allow_national: boolean;
  allow_mobile: boolean;
  allow_international: boolean;
  allow_premium_rate: boolean;
  allow_toll_free: boolean;
  allow_special: boolean;
  emergency_always_allowed: boolean;
  exceptions: PolicyException[];
  status: CallingPolicyStatus;
  created_at: Date;
  updated_at: Date;
}

export interface CallingPolicyAssignment {
  id: string;
  tenant_id: string;
  policy_id: string;
  assignable_type: PolicyAssignableType;
  assignable_id: string | null;
  created_at: Date;
}

export interface CreateCallingPolicyInput {
  name: string;
  description?: string;
  allow_local?: boolean;
  allow_national?: boolean;
  allow_mobile?: boolean;
  allow_international?: boolean;
  allow_premium_rate?: boolean;
  allow_toll_free?: boolean;
  allow_special?: boolean;
  emergency_always_allowed?: boolean;
  exceptions?: PolicyException[];
}

export interface UpdateCallingPolicyInput {
  name?: string;
  description?: string | null;
  allow_local?: boolean;
  allow_national?: boolean;
  allow_mobile?: boolean;
  allow_international?: boolean;
  allow_premium_rate?: boolean;
  allow_toll_free?: boolean;
  allow_special?: boolean;
  emergency_always_allowed?: boolean;
  exceptions?: PolicyException[];
  status?: CallingPolicyStatus;
}

export interface CallTypeCheckResult {
  call_type: string;
  allowed: boolean;
  reason: string;
  policy_id: string | null;
  is_advisory: true;
}
