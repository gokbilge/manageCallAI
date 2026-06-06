export type TrunkGroupStatus = 'active' | 'inactive';
export type SelectionStrategy = 'priority' | 'round_robin' | 'weight';
export type RouteListStatus = 'active' | 'inactive';
export type RouteListEntryType = 'sip_trunk' | 'trunk_group' | 'outbound_route';

export interface TrunkGroup {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  selection_strategy: SelectionStrategy;
  status: TrunkGroupStatus;
  created_at: Date;
  updated_at: Date;
}

export interface TrunkGroupMember {
  id: string;
  tenant_id: string;
  trunk_group_id: string;
  trunk_id: string;
  priority: number;
  weight: number;
  created_at: Date;
}

export interface TrunkGroupWithMembers extends TrunkGroup {
  members: TrunkGroupMember[];
}

export interface RouteList {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  status: RouteListStatus;
  created_at: Date;
  updated_at: Date;
}

export interface RouteListEntry {
  id: string;
  tenant_id: string;
  route_list_id: string;
  entry_type: RouteListEntryType;
  entry_id: string;
  priority: number;
  created_at: Date;
}

export interface RouteListWithEntries extends RouteList {
  entries: RouteListEntry[];
}

export interface CreateTrunkGroupInput {
  name: string;
  description?: string;
  selection_strategy?: SelectionStrategy;
}

export interface UpdateTrunkGroupInput {
  name?: string;
  description?: string | null;
  selection_strategy?: SelectionStrategy;
  status?: TrunkGroupStatus;
}

export interface AddMemberInput {
  trunk_id: string;
  priority?: number;
  weight?: number;
}

export interface CreateRouteListInput {
  name: string;
  description?: string;
}

export interface UpdateRouteListInput {
  name?: string;
  description?: string | null;
  status?: RouteListStatus;
}

export interface AddRouteListEntryInput {
  entry_type: RouteListEntryType;
  entry_id: string;
  priority?: number;
}

// ── Simulation types (#306) ───────────────────────────────────────────────────

export type SimulationOutcomeStatus = 'routed' | 'no_trunks' | 'all_failed';

export interface TrunkSimulationStep {
  trunk_id: string;
  trunk_name: string;
  role: 'primary' | 'failover';
  priority: number;
  would_attempt: boolean;
  failover_reason: string | null;
}

export interface TrunkGroupSimulation {
  trunk_group_id: string;
  trunk_group_name: string;
  selection_strategy: SelectionStrategy;
  dial_string: string;
  outcome: SimulationOutcomeStatus;
  selected_trunk_id: string | null;
  steps: TrunkSimulationStep[];
  is_advisory: true;
  simulated_at: string;
}

// ── Site-aware carrier resolution types (#307) ────────────────────────────────

export interface CarrierResolutionTrace {
  site_id: string | null;
  site_name: string | null;
  dial_string: string;
  default_outbound_route_id: string | null;
  resolved_trunk_group_id: string | null;
  resolved_trunk_id: string | null;
  resolution_path: string[];
  is_advisory: true;
  resolved_at: string;
}
