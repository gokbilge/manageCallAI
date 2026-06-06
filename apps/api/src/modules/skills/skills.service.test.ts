import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SkillsRepository } from './skills.repository.js';
import type { AgentSkill, QueueSkillRequirement, RoutingEvaluation, Skill } from './skills.types.js';
import {
  AgentSkillNotFoundError,
  SkillNotFoundError,
  SkillValidationError,
  SkillsService,
} from './skills.service.js';

const TENANT = 'tenant-1';
const QUEUE = 'queue-1';
const AGENT = 'agent-1';

const baseSkill: Skill = {
  id: 'skill-1',
  tenant_id: TENANT,
  name: 'Spanish',
  description: null,
  status: 'active',
  created_at: new Date(),
  updated_at: new Date(),
};

const baseAgentSkill: AgentSkill = {
  id: 'as-1',
  tenant_id: TENANT,
  agent_profile_id: AGENT,
  skill_id: 'skill-1',
  skill_name: 'Spanish',
  proficiency: 3,
  created_at: new Date(),
};

const baseRequirement: QueueSkillRequirement = {
  id: 'req-1',
  tenant_id: TENANT,
  queue_id: QUEUE,
  skill_id: 'skill-1',
  skill_name: 'Spanish',
  min_proficiency: 2,
  created_at: new Date(),
};

const baseEval: RoutingEvaluation = {
  id: 'ev-1',
  tenant_id: TENANT,
  queue_id: QUEUE,
  agent_profile_id: AGENT,
  eligible: true,
  reason: 'agent meets all skill requirements',
  evaluated_at: new Date(),
};

function makeRepo(overrides: Partial<SkillsRepository> = {}): SkillsRepository {
  return {
    findAllByTenant: vi.fn().mockResolvedValue([baseSkill]),
    findById: vi.fn().mockResolvedValue(baseSkill),
    findActiveById: vi.fn().mockResolvedValue(baseSkill),
    create: vi.fn().mockResolvedValue(baseSkill),
    update: vi.fn().mockResolvedValue(baseSkill),
    findAgentSkills: vi.fn().mockResolvedValue([baseAgentSkill]),
    assignSkill: vi.fn().mockResolvedValue(baseAgentSkill),
    removeSkill: vi.fn().mockResolvedValue(true),
    findQueueRequirements: vi.fn().mockResolvedValue([baseRequirement]),
    addQueueRequirement: vi.fn().mockResolvedValue(baseRequirement),
    removeQueueRequirement: vi.fn().mockResolvedValue(true),
    logRoutingEvaluation: vi.fn().mockResolvedValue(baseEval),
    findRoutingLog: vi.fn().mockResolvedValue([baseEval]),
    ...overrides,
  } as unknown as SkillsRepository;
}

describe('SkillsService', () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: SkillsService;

  beforeEach(() => {
    repo = makeRepo();
    service = new SkillsService(repo);
  });

  it('creates a skill', async () => {
    await service.create({ tenant_id: TENANT, name: 'French' });
    expect(vi.mocked(repo.create)).toHaveBeenCalledWith(expect.objectContaining({ name: 'French' }));
  });

  it('rejects blank skill name', async () => {
    await expect(service.create({ tenant_id: TENANT, name: '   ' })).rejects.toBeInstanceOf(SkillValidationError);
  });

  it('throws SkillNotFoundError when missing', async () => {
    repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
    service = new SkillsService(repo);
    await expect(service.getById('bad', TENANT)).rejects.toBeInstanceOf(SkillNotFoundError);
  });

  it('rejects invalid proficiency when assigning skill', async () => {
    await expect(service.assignSkill(AGENT, TENANT, { skill_id: 'skill-1', proficiency: 0 }))
      .rejects.toBeInstanceOf(SkillValidationError);
    await expect(service.assignSkill(AGENT, TENANT, { skill_id: 'skill-1', proficiency: 6 }))
      .rejects.toBeInstanceOf(SkillValidationError);
  });

  it('throws SkillNotFoundError when assigning inactive skill', async () => {
    repo = makeRepo({ findActiveById: vi.fn().mockResolvedValue(null) });
    service = new SkillsService(repo);
    await expect(service.assignSkill(AGENT, TENANT, { skill_id: 'skill-1' })).rejects.toBeInstanceOf(SkillNotFoundError);
  });

  it('throws AgentSkillNotFoundError when removing non-existent skill', async () => {
    repo = makeRepo({ removeSkill: vi.fn().mockResolvedValue(false) });
    service = new SkillsService(repo);
    await expect(service.removeSkill(AGENT, 'skill-x', TENANT)).rejects.toBeInstanceOf(AgentSkillNotFoundError);
  });

  it('evaluates routing: eligible when agent meets requirements', async () => {
    const result = await service.evaluateRouting(QUEUE, AGENT, TENANT);
    expect(result.eligible).toBe(true);
    expect(vi.mocked(repo.logRoutingEvaluation)).toHaveBeenCalledWith(
      TENANT, QUEUE, AGENT, true, expect.any(String),
    );
  });

  it('evaluates routing: ineligible when agent proficiency is too low', async () => {
    repo = makeRepo({
      findQueueRequirements: vi.fn().mockResolvedValue([{ ...baseRequirement, min_proficiency: 5 }]),
      findAgentSkills: vi.fn().mockResolvedValue([{ ...baseAgentSkill, proficiency: 2 }]),
      logRoutingEvaluation: vi.fn().mockResolvedValue({ ...baseEval, eligible: false }),
    });
    service = new SkillsService(repo);
    const result = await service.evaluateRouting(QUEUE, AGENT, TENANT);
    expect(result.eligible).toBe(false);
    expect(vi.mocked(repo.logRoutingEvaluation)).toHaveBeenCalledWith(
      TENANT, QUEUE, AGENT, false, expect.stringContaining('Spanish'),
    );
  });

  it('evaluates routing: eligible when queue has no requirements', async () => {
    repo = makeRepo({ findQueueRequirements: vi.fn().mockResolvedValue([]) });
    service = new SkillsService(repo);
    const result = await service.evaluateRouting(QUEUE, AGENT, TENANT);
    expect(vi.mocked(repo.logRoutingEvaluation)).toHaveBeenCalledWith(
      TENANT, QUEUE, AGENT, true, 'queue has no skill requirements',
    );
    expect(result.eligible).toBe(true);
  });
});
