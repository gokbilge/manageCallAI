export const FEATURE_CODE_ACTION_TYPES = [
  'voicemail_access',
  'call_forward_enable',
  'call_forward_disable',
  'dnd_enable',
  'dnd_disable',
  'call_pickup',
  'call_park',
  'call_park_retrieve',
  'conference_join',
] as const;

export type FeatureCodeActionType = typeof FEATURE_CODE_ACTION_TYPES[number];

export const FEATURE_CODE_STATUSES = ['draft', 'active', 'disabled'] as const;
export type FeatureCodeStatus = typeof FEATURE_CODE_STATUSES[number];

export interface FeatureCode {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  description: string | null;
  action_type: FeatureCodeActionType;
  action_config: Record<string, unknown>;
  status: FeatureCodeStatus;
  requires_approval: boolean;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  published_at: Date | null;
}

export interface CreateFeatureCodeInput {
  tenant_id: string;
  code: string;
  name: string;
  description?: string | null;
  action_type: FeatureCodeActionType;
  action_config?: Record<string, unknown>;
  requires_approval?: boolean;
  created_by?: string | null;
}

export interface UpdateFeatureCodeInput {
  name?: string;
  description?: string | null;
  action_type?: FeatureCodeActionType;
  action_config?: Record<string, unknown>;
  requires_approval?: boolean;
}
