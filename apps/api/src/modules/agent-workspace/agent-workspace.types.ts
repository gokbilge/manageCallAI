export type AgentStatus = 'active' | 'inactive';
export type AgentAvailabilityState = 'available' | 'busy' | 'away' | 'wrap_up' | 'offline';

export interface AgentProfile {
  id: string;
  tenant_id: string;
  user_id: string;
  display_name: string;
  max_concurrent_calls: number;
  status: AgentStatus;
  created_at: Date;
  updated_at: Date;
}

export interface AgentAvailability {
  id: string;
  tenant_id: string;
  agent_profile_id: string;
  state: AgentAvailabilityState;
  reason: string | null;
  updated_at: Date;
}

export interface AgentProfileWithAvailability extends AgentProfile {
  availability: AgentAvailability | null;
}

export interface CreateAgentProfileInput {
  tenant_id: string;
  user_id: string;
  display_name: string;
  max_concurrent_calls?: number;
}

export interface UpdateAgentProfileInput {
  display_name?: string;
  max_concurrent_calls?: number;
  status?: AgentStatus;
}

export interface SetAvailabilityInput {
  state: AgentAvailabilityState;
  reason?: string | null;
}

// Valid transitions from each state.
const VALID_TRANSITIONS: Record<AgentAvailabilityState, AgentAvailabilityState[]> = {
  offline: ['available'],
  available: ['busy', 'away', 'wrap_up', 'offline'],
  busy: ['available', 'wrap_up', 'offline'],
  wrap_up: ['available', 'away', 'offline'],
  away: ['available', 'offline'],
};

export function isValidTransition(
  from: AgentAvailabilityState,
  to: AgentAvailabilityState,
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}
