import type { Pool } from 'pg';
import type {
  AgentAvailability,
  AgentProfile,
  AgentProfileWithAvailability,
  CreateAgentProfileInput,
  SetAvailabilityInput,
  UpdateAgentProfileInput,
} from './agent-workspace.types.js';

const PROFILE_COLUMNS = `id, tenant_id, user_id, display_name, max_concurrent_calls,
  status, created_at, updated_at`;

const AVAILABILITY_COLUMNS = `id, tenant_id, agent_profile_id, state, reason, updated_at`;

export class AgentWorkspaceRepository {
  constructor(private readonly db: Pool) {}

  async findAllByTenant(tenantId: string): Promise<AgentProfileWithAvailability[]> {
    const r = await this.db.query<AgentProfile & { av_id: string | null; av_state: string | null; av_reason: string | null; av_updated_at: Date | null }>(
      `SELECT p.${PROFILE_COLUMNS.replace(/\n\s+/g, ' ')
        .split(',').map(c => `p.${c.trim()}`).join(', ')},
              a.id AS av_id, a.state AS av_state, a.reason AS av_reason, a.updated_at AS av_updated_at
       FROM agent_profiles p
       LEFT JOIN agent_availability a ON a.agent_profile_id = p.id
       WHERE p.tenant_id = $1
       ORDER BY p.created_at DESC`,
      [tenantId],
    );
    return r.rows.map(rowToProfileWithAvailability);
  }

  async findById(id: string, tenantId: string): Promise<AgentProfileWithAvailability | null> {
    const r = await this.db.query<AgentProfile & { av_id: string | null; av_state: string | null; av_reason: string | null; av_updated_at: Date | null }>(
      `SELECT p.id, p.tenant_id, p.user_id, p.display_name, p.max_concurrent_calls,
              p.status, p.created_at, p.updated_at,
              a.id AS av_id, a.state AS av_state, a.reason AS av_reason, a.updated_at AS av_updated_at
       FROM agent_profiles p
       LEFT JOIN agent_availability a ON a.agent_profile_id = p.id
       WHERE p.id = $1 AND p.tenant_id = $2`,
      [id, tenantId],
    );
    if (!r.rows[0]) return null;
    return rowToProfileWithAvailability(r.rows[0]);
  }

  async findByUserId(userId: string, tenantId: string): Promise<AgentProfileWithAvailability | null> {
    const r = await this.db.query<AgentProfile & { av_id: string | null; av_state: string | null; av_reason: string | null; av_updated_at: Date | null }>(
      `SELECT p.id, p.tenant_id, p.user_id, p.display_name, p.max_concurrent_calls,
              p.status, p.created_at, p.updated_at,
              a.id AS av_id, a.state AS av_state, a.reason AS av_reason, a.updated_at AS av_updated_at
       FROM agent_profiles p
       LEFT JOIN agent_availability a ON a.agent_profile_id = p.id
       WHERE p.user_id = $1 AND p.tenant_id = $2`,
      [userId, tenantId],
    );
    if (!r.rows[0]) return null;
    return rowToProfileWithAvailability(r.rows[0]);
  }

  async create(input: CreateAgentProfileInput): Promise<AgentProfileWithAvailability> {
    const r = await this.db.query<AgentProfile>(
      `INSERT INTO agent_profiles (tenant_id, user_id, display_name, max_concurrent_calls)
       VALUES ($1, $2, $3, $4)
       RETURNING ${PROFILE_COLUMNS}`,
      [
        input.tenant_id,
        input.user_id,
        input.display_name,
        input.max_concurrent_calls ?? 1,
      ],
    );
    return { ...r.rows[0]!, availability: null };
  }

  async update(id: string, tenantId: string, input: UpdateAgentProfileInput): Promise<AgentProfile | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.display_name !== undefined) { fields.push(`display_name = $${idx++}`); values.push(input.display_name); }
    if (input.max_concurrent_calls !== undefined) { fields.push(`max_concurrent_calls = $${idx++}`); values.push(input.max_concurrent_calls); }
    if (input.status !== undefined) { fields.push(`status = $${idx++}`); values.push(input.status); }

    if (fields.length === 0) {
      const r = await this.db.query<AgentProfile>(
        `SELECT ${PROFILE_COLUMNS} FROM agent_profiles WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId],
      );
      return r.rows[0] ?? null;
    }

    fields.push('updated_at = NOW()');
    values.push(id, tenantId);
    const r = await this.db.query<AgentProfile>(
      `UPDATE agent_profiles SET ${fields.join(', ')}
       WHERE id = $${idx} AND tenant_id = $${idx + 1}
       RETURNING ${PROFILE_COLUMNS}`,
      values,
    );
    return r.rows[0] ?? null;
  }

  async deactivate(id: string, tenantId: string): Promise<AgentProfile | null> {
    const r = await this.db.query<AgentProfile>(
      `UPDATE agent_profiles SET status = 'inactive', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING ${PROFILE_COLUMNS}`,
      [id, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async getAvailability(agentProfileId: string, tenantId: string): Promise<AgentAvailability | null> {
    const r = await this.db.query<AgentAvailability>(
      `SELECT ${AVAILABILITY_COLUMNS}
       FROM agent_availability
       WHERE agent_profile_id = $1 AND tenant_id = $2`,
      [agentProfileId, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async upsertAvailability(agentProfileId: string, tenantId: string, input: SetAvailabilityInput): Promise<AgentAvailability> {
    const r = await this.db.query<AgentAvailability>(
      `INSERT INTO agent_availability (tenant_id, agent_profile_id, state, reason)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, agent_profile_id)
       DO UPDATE SET state = EXCLUDED.state, reason = EXCLUDED.reason, updated_at = NOW()
       RETURNING ${AVAILABILITY_COLUMNS}`,
      [tenantId, agentProfileId, input.state, input.reason ?? null],
    );
    return r.rows[0]!;
  }

  async findAvailableByQueue(queueId: string, tenantId: string): Promise<AgentProfileWithAvailability[]> {
    const r = await this.db.query<AgentProfile & { av_id: string; av_state: string; av_reason: string | null; av_updated_at: Date }>(
      `SELECT p.id, p.tenant_id, p.user_id, p.display_name, p.max_concurrent_calls,
              p.status, p.created_at, p.updated_at,
              a.id AS av_id, a.state AS av_state, a.reason AS av_reason, a.updated_at AS av_updated_at
       FROM agent_profiles p
       JOIN queue_members qm ON qm.extension_id IN (
         SELECT e.id FROM extensions e WHERE e.owner_user_id = p.user_id AND e.tenant_id = p.tenant_id
       )
       JOIN agent_availability a ON a.agent_profile_id = p.id
       WHERE qm.queue_id = $1 AND p.tenant_id = $2
         AND p.status = 'active' AND a.state = 'available'
       ORDER BY a.updated_at ASC`,
      [queueId, tenantId],
    );
    return r.rows.map(rowToProfileWithAvailability);
  }
}

function rowToProfileWithAvailability(
  row: AgentProfile & { av_id: string | null; av_state: string | null; av_reason: string | null; av_updated_at: Date | null },
): AgentProfileWithAvailability {
  const { av_id, av_state, av_reason, av_updated_at, ...profile } = row;
  const availability =
    av_id != null && av_state != null && av_updated_at != null
      ? {
          id: av_id,
          tenant_id: profile.tenant_id,
          agent_profile_id: profile.id,
          state: av_state as AgentAvailability['state'],
          reason: av_reason,
          updated_at: av_updated_at,
        }
      : null;
  return { ...profile, availability };
}
