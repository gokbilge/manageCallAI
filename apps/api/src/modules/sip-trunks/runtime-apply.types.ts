export const RUNTIME_APPLY_ACTION_TYPES = [
  'reloadxml',
  'sofia_profile_rescan',
  'sofia_profile_killgw',
  'sofia_profile_restartgw',
  'sofia_status_gateway',
  'sofia_status_profile',
] as const;

export type RuntimeApplyActionType = typeof RUNTIME_APPLY_ACTION_TYPES[number];

export const RUNTIME_APPLY_STATUSES = [
  'pending',
  'applying',
  'applied',
  'failed',
  'cancelled',
] as const;

export type RuntimeApplyStatus = typeof RUNTIME_APPLY_STATUSES[number];

export interface RuntimeApplyRequest {
  id: string;
  tenant_id: string | null;
  triggered_by_type: 'user' | 'workflow' | 'system';
  triggered_by_id: string | null;
  action_type: RuntimeApplyActionType;
  target_node_id: string;
  target_profile: string | null;
  target_gateway: string | null;
  object_type: string;
  object_id: string;
  status: RuntimeApplyStatus;
  active_call_count: number | null;
  applied_at: Date | null;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

// What the Go agent sees when it polls for pending work
export interface PendingApplyRequest {
  id: string;
  action_type: RuntimeApplyActionType;
  target_profile: string | null;
  target_gateway: string | null;
  object_type: string;
  object_id: string;
}

export interface CreateApplyRequestInput {
  tenant_id: string | null;
  triggered_by_type: 'user' | 'workflow' | 'system';
  triggered_by_id: string | null;
  action_type: RuntimeApplyActionType;
  target_node_id: string;
  target_profile?: string | null;
  target_gateway?: string | null;
  object_type: string;
  object_id: string;
}

export interface ApplyResultInput {
  status: 'applied' | 'failed';
  error_message?: string | null;
}
