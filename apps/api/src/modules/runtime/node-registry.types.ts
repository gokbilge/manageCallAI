// SLICE-43: FreeSWITCH node registry types

export type NodeStatus = 'active' | 'disabled' | 'decommissioned';

export const NODE_CAPABILITIES = [
  'dialplan',
  'directory',
  'event_ingest',
  'outbound_poll',
] as const;
export type NodeCapability = (typeof NODE_CAPABILITIES)[number];

export interface FreeSwitchNode {
  id: string;
  display_name: string;
  status: NodeStatus;
  allowed_cidrs: string[];
  capabilities: string[];
  rate_limit_policy: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateNodeInput {
  display_name: string;
  allowed_cidrs?: string[];
  capabilities?: string[];
  rate_limit_policy?: Record<string, unknown>;
}

export interface UpdateNodeInput {
  display_name?: string;
  status?: NodeStatus;
  allowed_cidrs?: string[];
  capabilities?: string[];
  rate_limit_policy?: Record<string, unknown>;
}

export interface NodeCreated {
  node: FreeSwitchNode;
  raw_token: string;
}

export interface NodeTokenRotated {
  node: FreeSwitchNode;
  raw_token: string;
}
