import type { SkillsRepository } from './skills.repository.js';
import type {
  AddQueueSkillRequirementInput,
  AgentSkill,
  AssignAgentSkillInput,
  CreateSkillInput,
  QueueSkillRequirement,
  RoutingEvaluation,
  Skill,
  UpdateSkillInput,
} from './skills.types.js';

export class SkillNotFoundError extends Error {
  constructor(id: string) {
    super(`Skill not found: ${id}`);
    this.name = 'SkillNotFoundError';
  }
}

export class SkillRequirementNotFoundError extends Error {
  constructor(id: string) {
    super(`Queue skill requirement not found: ${id}`);
    this.name = 'SkillRequirementNotFoundError';
  }
}

export class AgentSkillNotFoundError extends Error {
  constructor(agentId: string, skillId: string) {
    super(`Agent skill not found: agent=${agentId} skill=${skillId}`);
    this.name = 'AgentSkillNotFoundError';
  }
}

export class SkillValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkillValidationError';
  }
}

export class SkillsService {
  constructor(private readonly repo: SkillsRepository) {}

  // ── Skills ────────────────────────────────────────────────────────────────

  listByTenant(tenantId: string): Promise<Skill[]> {
    return this.repo.findAllByTenant(tenantId);
  }

  async getById(id: string, tenantId: string): Promise<Skill> {
    const skill = await this.repo.findById(id, tenantId);
    if (!skill) throw new SkillNotFoundError(id);
    return skill;
  }

  async create(input: CreateSkillInput): Promise<Skill> {
    if (!input.name.trim()) throw new SkillValidationError('name must not be blank');
    return this.repo.create(input);
  }

  async update(id: string, tenantId: string, input: UpdateSkillInput): Promise<Skill> {
    if (input.name !== undefined && !input.name.trim()) {
      throw new SkillValidationError('name must not be blank');
    }
    const skill = await this.repo.update(id, tenantId, input);
    if (!skill) throw new SkillNotFoundError(id);
    return skill;
  }

  // ── Agent skills ──────────────────────────────────────────────────────────

  listAgentSkills(agentProfileId: string, tenantId: string): Promise<AgentSkill[]> {
    return this.repo.findAgentSkills(agentProfileId, tenantId);
  }

  async assignSkill(agentProfileId: string, tenantId: string, input: AssignAgentSkillInput): Promise<AgentSkill> {
    if (input.proficiency !== undefined) {
      validateProficiency(input.proficiency);
    }
    const skill = await this.repo.findActiveById(input.skill_id, tenantId);
    if (!skill) throw new SkillNotFoundError(input.skill_id);
    return this.repo.assignSkill(agentProfileId, tenantId, input);
  }

  async removeSkill(agentProfileId: string, skillId: string, tenantId: string): Promise<void> {
    const removed = await this.repo.removeSkill(agentProfileId, skillId, tenantId);
    if (!removed) throw new AgentSkillNotFoundError(agentProfileId, skillId);
  }

  // ── Queue skill requirements ──────────────────────────────────────────────

  listQueueRequirements(queueId: string, tenantId: string): Promise<QueueSkillRequirement[]> {
    return this.repo.findQueueRequirements(queueId, tenantId);
  }

  async addQueueRequirement(queueId: string, tenantId: string, input: AddQueueSkillRequirementInput): Promise<QueueSkillRequirement> {
    if (input.min_proficiency !== undefined) {
      validateProficiency(input.min_proficiency);
    }
    const skill = await this.repo.findActiveById(input.skill_id, tenantId);
    if (!skill) throw new SkillNotFoundError(input.skill_id);
    return this.repo.addQueueRequirement(queueId, tenantId, input);
  }

  async removeQueueRequirement(queueId: string, requirementId: string, tenantId: string): Promise<void> {
    const removed = await this.repo.removeQueueRequirement(queueId, requirementId, tenantId);
    if (!removed) throw new SkillRequirementNotFoundError(requirementId);
  }

  // ── Routing evaluation ────────────────────────────────────────────────────

  async evaluateRouting(queueId: string, agentProfileId: string, tenantId: string): Promise<RoutingEvaluation> {
    const requirements = await this.repo.findQueueRequirements(queueId, tenantId);
    const agentSkills = await this.repo.findAgentSkills(agentProfileId, tenantId);

    if (requirements.length === 0) {
      return this.repo.logRoutingEvaluation(tenantId, queueId, agentProfileId, true, 'queue has no skill requirements');
    }

    const skillMap = new Map(agentSkills.map((s) => [s.skill_id, s.proficiency]));
    const unmet = requirements.filter((req) => {
      const agentProficiency = skillMap.get(req.skill_id) ?? 0;
      return agentProficiency < req.min_proficiency;
    });

    if (unmet.length === 0) {
      return this.repo.logRoutingEvaluation(tenantId, queueId, agentProfileId, true, 'agent meets all skill requirements');
    }

    const detail = unmet.map((u) => {
      const has = skillMap.get(u.skill_id) ?? 0;
      return `${u.skill_name} requires ${u.min_proficiency}, agent has ${has}`;
    }).join('; ');
    return this.repo.logRoutingEvaluation(tenantId, queueId, agentProfileId, false, `unmet requirements: ${detail}`);
  }

  listRoutingLog(queueId: string, tenantId: string): Promise<RoutingEvaluation[]> {
    return this.repo.findRoutingLog(queueId, tenantId);
  }
}

function validateProficiency(value: number): void {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new SkillValidationError('proficiency must be an integer between 1 and 5');
  }
}
