export type CallType =
  | 'local' | 'national' | 'mobile' | 'international'
  | 'premium_rate' | 'emergency' | 'toll_free' | 'special';

export type NumberingPlanStatus = 'active' | 'inactive';
export type AssignableType = 'extension' | 'sip_trunk' | 'tenant';

export interface NumberingPlan {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  country_code: string | null;
  status: NumberingPlanStatus;
  created_at: Date;
  updated_at: Date;
}

export interface NumberingRule {
  id: string;
  tenant_id: string;
  plan_id: string;
  name: string;
  pattern: string;
  call_type: CallType;
  priority: number;
  description: string | null;
  created_at: Date;
}

export interface NumberingPlanAssignment {
  id: string;
  tenant_id: string;
  plan_id: string;
  assignable_type: AssignableType;
  assignable_id: string | null;
  created_at: Date;
}

export interface CreateNumberingPlanInput {
  name: string;
  description?: string;
  country_code?: string;
}

export interface UpdateNumberingPlanInput {
  name?: string;
  description?: string | null;
  country_code?: string | null;
  status?: NumberingPlanStatus;
}

export interface CreateNumberingRuleInput {
  name: string;
  pattern: string;
  call_type: CallType;
  priority?: number;
  description?: string;
}

export interface NumberingPlanWithRules extends NumberingPlan {
  rules: NumberingRule[];
}

export interface DialCheckResult {
  dial_string: string;
  matched_rule: NumberingRule | null;
  call_type: CallType | null;
  plan_id: string | null;
  is_advisory: true;
}
