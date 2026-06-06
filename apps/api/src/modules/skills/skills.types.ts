export type SkillStatus = 'active' | 'inactive';

export interface Skill {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  status: SkillStatus;
  created_at: Date;
  updated_at: Date;
}

export interface AgentSkill {
  id: string;
  tenant_id: string;
  agent_profile_id: string;
  skill_id: string;
  skill_name: string;
  proficiency: number;
  created_at: Date;
}

export interface QueueSkillRequirement {
  id: string;
  tenant_id: string;
  queue_id: string;
  skill_id: string;
  skill_name: string;
  min_proficiency: number;
  created_at: Date;
}

export interface RoutingEvaluation {
  id: string;
  tenant_id: string;
  queue_id: string;
  agent_profile_id: string;
  eligible: boolean;
  reason: string;
  evaluated_at: Date;
}

export interface CreateSkillInput {
  tenant_id: string;
  name: string;
  description?: string;
}

export interface UpdateSkillInput {
  name?: string;
  description?: string | null;
  status?: SkillStatus;
}

export interface AssignAgentSkillInput {
  skill_id: string;
  proficiency?: number;
}

export interface AddQueueSkillRequirementInput {
  skill_id: string;
  min_proficiency?: number;
}
