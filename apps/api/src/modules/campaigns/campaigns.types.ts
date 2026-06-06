export type CampaignType = 'outbound_preview' | 'outbound_progressive';
export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
export type ContactDialState = 'pending' | 'dialing' | 'reached' | 'no_answer' | 'failed' | 'skipped';

export interface Campaign {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  campaign_type: CampaignType;
  status: CampaignStatus;
  outbound_route_id: string | null;
  max_concurrent_calls: number;
  schedule_start_time: string | null;
  schedule_end_time: string | null;
  schedule_timezone: string;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CampaignContact {
  id: string;
  tenant_id: string;
  campaign_id: string;
  phone_number: string;
  display_name: string | null;
  context: Record<string, unknown>;
  dial_state: ContactDialState;
  attempt_count: number;
  last_attempted_at: Date | null;
  created_at: Date;
}

export interface CampaignAssignment {
  id: string;
  tenant_id: string;
  campaign_id: string;
  agent_profile_id: string;
  assigned_at: Date;
}

export interface CreateCampaignInput {
  tenant_id: string;
  name: string;
  description?: string;
  campaign_type?: CampaignType;
  outbound_route_id?: string | null;
  max_concurrent_calls?: number;
  schedule_start_time?: string | null;
  schedule_end_time?: string | null;
  schedule_timezone?: string;
}

export interface UpdateCampaignInput {
  name?: string;
  description?: string | null;
  outbound_route_id?: string | null;
  max_concurrent_calls?: number;
  schedule_start_time?: string | null;
  schedule_end_time?: string | null;
  schedule_timezone?: string;
}

export interface AddCampaignContactInput {
  phone_number: string;
  display_name?: string;
  context?: Record<string, unknown>;
}

export interface AssignCampaignAgentInput {
  agent_profile_id: string;
}
