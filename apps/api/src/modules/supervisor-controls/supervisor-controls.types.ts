export type SupervisorControlType = 'monitor' | 'whisper' | 'barge';
export type SupervisorControlStatus = 'pending' | 'active' | 'ended';

export interface SupervisorControl {
  id: string;
  tenant_id: string;
  supervisor_user_id: string;
  control_type: SupervisorControlType;
  target_call_id: string;
  status: SupervisorControlStatus;
  audit_note: string | null;
  created_at: Date;
  updated_at: Date;
  ended_at: Date | null;
}

export interface CreateSupervisorControlInput {
  tenant_id: string;
  supervisor_user_id: string;
  control_type: SupervisorControlType;
  target_call_id: string;
  audit_note?: string | null;
}

export interface UpdateSupervisorControlInput {
  status?: SupervisorControlStatus;
  audit_note?: string | null;
}

// Valid supervisor control transitions.
const VALID_TRANSITIONS: Record<SupervisorControlStatus, SupervisorControlStatus[]> = {
  pending: ['active', 'ended'],
  active: ['ended'],
  ended: [],
};

export function isValidControlTransition(
  from: SupervisorControlStatus,
  to: SupervisorControlStatus,
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}
