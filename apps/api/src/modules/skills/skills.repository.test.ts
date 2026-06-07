import { describe, it, expect, vi } from 'vitest';
import type { Pool } from 'pg';
import { SkillsRepository } from './skills.repository.js';
import type { Skill, AgentSkill, QueueSkillRequirement, RoutingEvaluation } from './skills.types.js';

const TENANT = 'tenant-1';
const SKILL_ID = 'skill-1';
const AGENT_ID = 'agent-1';
const QUEUE_ID = 'queue-1';
const REQ_ID = 'req-1';

const baseSkill: Skill = {
  id: SKILL_ID, tenant_id: TENANT, name: 'English', description: null,
  status: 'active', created_at: new Date(), updated_at: new Date(),
};

const baseAgentSkill: AgentSkill = {
  id: 'ags-1', tenant_id: TENANT, agent_profile_id: AGENT_ID,
  skill_id: SKILL_ID, skill_name: 'English', proficiency: 3, created_at: new Date(),
};

const baseQueueReq: QueueSkillRequirement = {
  id: REQ_ID, tenant_id: TENANT, queue_id: QUEUE_ID,
  skill_id: SKILL_ID, skill_name: 'English', min_proficiency: 2, created_at: new Date(),
};

const baseEval: RoutingEvaluation = {
  id: 'eval-1', tenant_id: TENANT, queue_id: QUEUE_ID,
  agent_profile_id: AGENT_ID, eligible: true, reason: 'all requirements met', evaluated_at: new Date(),
};

function makePool(rows: unknown[] = []): Pool {
  return { query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }) } as unknown as Pool;
}

describe('SkillsRepository', () => {
  it('findAllByTenant returns all skills', async () => {
    const pool = makePool([baseSkill]);
    expect(await new SkillsRepository(pool).findAllByTenant(TENANT)).toHaveLength(1);
  });

  it('findById returns skill when found', async () => {
    const pool = makePool([baseSkill]);
    expect((await new SkillsRepository(pool).findById(SKILL_ID, TENANT))?.name).toBe('English');
  });

  it('findById returns null when not found', async () => {
    const pool = makePool([]);
    expect(await new SkillsRepository(pool).findById('missing', TENANT)).toBeNull();
  });

  it('findActiveById returns active skill when found', async () => {
    const pool = makePool([baseSkill]);
    expect((await new SkillsRepository(pool).findActiveById(SKILL_ID, TENANT))?.status).toBe('active');
  });

  it('findActiveById returns null when not found', async () => {
    const pool = makePool([]);
    expect(await new SkillsRepository(pool).findActiveById('missing', TENANT)).toBeNull();
  });

  it('create inserts skill and returns it', async () => {
    const pool = makePool([baseSkill]);
    const result = await new SkillsRepository(pool).create({ tenant_id: TENANT, name: 'English', description: 'English language' });
    expect(result.name).toBe('English');
  });

  it('update with name and status returns updated skill', async () => {
    const updated = { ...baseSkill, name: 'Spanish', status: 'inactive' as const };
    const pool = makePool([updated]);
    const result = await new SkillsRepository(pool).update(SKILL_ID, TENANT, { name: 'Spanish', description: null, status: 'inactive' });
    expect(result?.name).toBe('Spanish');
  });

  it('update with no fields calls findById', async () => {
    const pool = makePool([baseSkill]);
    expect((await new SkillsRepository(pool).update(SKILL_ID, TENANT, {}))?.id).toBe(SKILL_ID);
  });

  it('update returns null when not found', async () => {
    const pool = makePool([]);
    expect(await new SkillsRepository(pool).update('missing', TENANT, { name: 'X' })).toBeNull();
  });

  it('findAgentSkills returns skills for agent', async () => {
    const pool = makePool([baseAgentSkill]);
    expect(await new SkillsRepository(pool).findAgentSkills(AGENT_ID, TENANT)).toHaveLength(1);
  });

  it('assignSkill upserts and returns agent skill with name', async () => {
    const pool = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ id: 'ags-1', tenant_id: TENANT, agent_profile_id: AGENT_ID, skill_id: SKILL_ID, proficiency: 3, created_at: new Date() }] })
        .mockResolvedValueOnce({ rows: [{ name: 'English' }] }),
    } as unknown as Pool;
    const result = await new SkillsRepository(pool).assignSkill(AGENT_ID, TENANT, { skill_id: SKILL_ID, proficiency: 3 });
    expect(result.skill_name).toBe('English');
  });

  it('removeSkill returns true when deleted', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }) } as unknown as Pool;
    expect(await new SkillsRepository(pool).removeSkill(AGENT_ID, SKILL_ID, TENANT)).toBe(true);
  });

  it('removeSkill returns false when not found', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) } as unknown as Pool;
    expect(await new SkillsRepository(pool).removeSkill(AGENT_ID, 'missing', TENANT)).toBe(false);
  });

  it('findQueueRequirements returns requirements for queue', async () => {
    const pool = makePool([baseQueueReq]);
    expect(await new SkillsRepository(pool).findQueueRequirements(QUEUE_ID, TENANT)).toHaveLength(1);
  });

  it('addQueueRequirement upserts and returns requirement with skill name', async () => {
    const pool = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ id: REQ_ID, tenant_id: TENANT, queue_id: QUEUE_ID, skill_id: SKILL_ID, min_proficiency: 2, created_at: new Date() }] })
        .mockResolvedValueOnce({ rows: [{ name: 'English' }] }),
    } as unknown as Pool;
    const result = await new SkillsRepository(pool).addQueueRequirement(QUEUE_ID, TENANT, { skill_id: SKILL_ID, min_proficiency: 2 });
    expect(result.skill_name).toBe('English');
  });

  it('removeQueueRequirement returns true when deleted', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }) } as unknown as Pool;
    expect(await new SkillsRepository(pool).removeQueueRequirement(QUEUE_ID, REQ_ID, TENANT)).toBe(true);
  });

  it('removeQueueRequirement returns false when not found', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) } as unknown as Pool;
    expect(await new SkillsRepository(pool).removeQueueRequirement(QUEUE_ID, 'missing', TENANT)).toBe(false);
  });

  it('logRoutingEvaluation inserts and returns eval record', async () => {
    const pool = makePool([baseEval]);
    const result = await new SkillsRepository(pool).logRoutingEvaluation(TENANT, QUEUE_ID, AGENT_ID, true, 'all requirements met');
    expect(result.eligible).toBe(true);
  });

  it('findRoutingLog returns evaluation log for queue', async () => {
    const pool = makePool([baseEval]);
    expect(await new SkillsRepository(pool).findRoutingLog(QUEUE_ID, TENANT)).toHaveLength(1);
  });
});
