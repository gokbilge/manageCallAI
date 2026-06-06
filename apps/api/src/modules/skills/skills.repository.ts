import type { Pool } from 'pg';
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

const SKILL_COLUMNS = `id, tenant_id, name, description, status, created_at, updated_at`;

export class SkillsRepository {
  constructor(private readonly db: Pool) {}

  // ── Skills ────────────────────────────────────────────────────────────────

  async findAllByTenant(tenantId: string): Promise<Skill[]> {
    const r = await this.db.query<Skill>(
      `SELECT ${SKILL_COLUMNS} FROM skills WHERE tenant_id = $1 ORDER BY name`,
      [tenantId],
    );
    return r.rows;
  }

  async findById(id: string, tenantId: string): Promise<Skill | null> {
    const r = await this.db.query<Skill>(
      `SELECT ${SKILL_COLUMNS} FROM skills WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async findActiveById(id: string, tenantId: string): Promise<Skill | null> {
    const r = await this.db.query<Skill>(
      `SELECT ${SKILL_COLUMNS} FROM skills WHERE id = $1 AND tenant_id = $2 AND status = 'active'`,
      [id, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async create(input: CreateSkillInput): Promise<Skill> {
    const r = await this.db.query<Skill>(
      `INSERT INTO skills (tenant_id, name, description)
       VALUES ($1, $2, $3)
       RETURNING ${SKILL_COLUMNS}`,
      [input.tenant_id, input.name, input.description ?? null],
    );
    return r.rows[0]!;
  }

  async update(id: string, tenantId: string, input: UpdateSkillInput): Promise<Skill | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.name !== undefined) { fields.push(`name = $${idx++}`); values.push(input.name); }
    if ('description' in input) { fields.push(`description = $${idx++}`); values.push(input.description ?? null); }
    if (input.status !== undefined) { fields.push(`status = $${idx++}`); values.push(input.status); }

    if (fields.length === 0) {
      return this.findById(id, tenantId);
    }

    fields.push('updated_at = NOW()');
    values.push(id, tenantId);
    const r = await this.db.query<Skill>(
      `UPDATE skills SET ${fields.join(', ')}
       WHERE id = $${idx} AND tenant_id = $${idx + 1}
       RETURNING ${SKILL_COLUMNS}`,
      values,
    );
    return r.rows[0] ?? null;
  }

  // ── Agent skills ──────────────────────────────────────────────────────────

  async findAgentSkills(agentProfileId: string, tenantId: string): Promise<AgentSkill[]> {
    const r = await this.db.query<AgentSkill>(
      `SELECT ags.id, ags.tenant_id, ags.agent_profile_id, ags.skill_id,
              s.name AS skill_name, ags.proficiency, ags.created_at
       FROM agent_skills ags
       JOIN skills s ON s.id = ags.skill_id
       WHERE ags.agent_profile_id = $1 AND ags.tenant_id = $2
       ORDER BY s.name`,
      [agentProfileId, tenantId],
    );
    return r.rows;
  }

  async assignSkill(agentProfileId: string, tenantId: string, input: AssignAgentSkillInput): Promise<AgentSkill> {
    const r = await this.db.query<{ id: string; skill_id: string; agent_profile_id: string; tenant_id: string; proficiency: number; created_at: Date }>(
      `INSERT INTO agent_skills (tenant_id, agent_profile_id, skill_id, proficiency)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, agent_profile_id, skill_id)
       DO UPDATE SET proficiency = EXCLUDED.proficiency
       RETURNING id, tenant_id, agent_profile_id, skill_id, proficiency, created_at`,
      [tenantId, agentProfileId, input.skill_id, input.proficiency ?? 1],
    );
    const row = r.rows[0]!;
    const skillR = await this.db.query<{ name: string }>(
      `SELECT name FROM skills WHERE id = $1`,
      [input.skill_id],
    );
    return { ...row, skill_name: skillR.rows[0]?.name ?? '' };
  }

  async removeSkill(agentProfileId: string, skillId: string, tenantId: string): Promise<boolean> {
    const r = await this.db.query(
      `DELETE FROM agent_skills
       WHERE agent_profile_id = $1 AND skill_id = $2 AND tenant_id = $3`,
      [agentProfileId, skillId, tenantId],
    );
    return (r.rowCount ?? 0) > 0;
  }

  // ── Queue skill requirements ──────────────────────────────────────────────

  async findQueueRequirements(queueId: string, tenantId: string): Promise<QueueSkillRequirement[]> {
    const r = await this.db.query<QueueSkillRequirement>(
      `SELECT qsr.id, qsr.tenant_id, qsr.queue_id, qsr.skill_id,
              s.name AS skill_name, qsr.min_proficiency, qsr.created_at
       FROM queue_skill_requirements qsr
       JOIN skills s ON s.id = qsr.skill_id
       WHERE qsr.queue_id = $1 AND qsr.tenant_id = $2
       ORDER BY s.name`,
      [queueId, tenantId],
    );
    return r.rows;
  }

  async addQueueRequirement(queueId: string, tenantId: string, input: AddQueueSkillRequirementInput): Promise<QueueSkillRequirement> {
    const r = await this.db.query<{ id: string; tenant_id: string; queue_id: string; skill_id: string; min_proficiency: number; created_at: Date }>(
      `INSERT INTO queue_skill_requirements (tenant_id, queue_id, skill_id, min_proficiency)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, queue_id, skill_id)
       DO UPDATE SET min_proficiency = EXCLUDED.min_proficiency
       RETURNING id, tenant_id, queue_id, skill_id, min_proficiency, created_at`,
      [tenantId, queueId, input.skill_id, input.min_proficiency ?? 1],
    );
    const row = r.rows[0]!;
    const skillR = await this.db.query<{ name: string }>(
      `SELECT name FROM skills WHERE id = $1`,
      [input.skill_id],
    );
    return { ...row, skill_name: skillR.rows[0]?.name ?? '' };
  }

  async removeQueueRequirement(queueId: string, requirementId: string, tenantId: string): Promise<boolean> {
    const r = await this.db.query(
      `DELETE FROM queue_skill_requirements
       WHERE id = $1 AND queue_id = $2 AND tenant_id = $3`,
      [requirementId, queueId, tenantId],
    );
    return (r.rowCount ?? 0) > 0;
  }

  // ── Routing evaluation ────────────────────────────────────────────────────

  async logRoutingEvaluation(
    tenantId: string,
    queueId: string,
    agentProfileId: string,
    eligible: boolean,
    reason: string,
  ): Promise<RoutingEvaluation> {
    const r = await this.db.query<RoutingEvaluation>(
      `INSERT INTO routing_evaluation_log
         (tenant_id, queue_id, agent_profile_id, eligible, reason)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, tenant_id, queue_id, agent_profile_id, eligible, reason, evaluated_at`,
      [tenantId, queueId, agentProfileId, eligible, reason],
    );
    return r.rows[0]!;
  }

  async findRoutingLog(queueId: string, tenantId: string, limit = 50): Promise<RoutingEvaluation[]> {
    const r = await this.db.query<RoutingEvaluation>(
      `SELECT id, tenant_id, queue_id, agent_profile_id, eligible, reason, evaluated_at
       FROM routing_evaluation_log
       WHERE queue_id = $1 AND tenant_id = $2
       ORDER BY evaluated_at DESC
       LIMIT $3`,
      [queueId, tenantId, limit],
    );
    return r.rows;
  }
}
