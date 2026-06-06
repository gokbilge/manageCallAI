import type { Pool } from 'pg';
import type {
  CallDisposition,
  DispositionCode,
  DispositionUsageRow,
  QaReview,
  QaScorecard,
  QueueSlaPolicy,
} from './contact-center.types.js';

type QueuePolicyRow = {
  queue_id: string;
  queue_name: string;
  member_count: number;
  answer_target_seconds: number;
  answer_rate_target_percent: number;
  abandonment_threshold_percent: number;
  wallboard_enabled: boolean;
};

type AgentAvailabilityCountRow = {
  state: 'available' | 'busy' | 'away' | 'wrap_up' | 'offline';
  count: number;
};

type RawCallEventRow = {
  call_id: string;
  event_type: string;
  event_time: Date;
  payload: Record<string, unknown>;
};

const DISPOSITION_COLUMNS = `
  id, tenant_id, queue_id, code, label, description, sort_order, status, created_at, updated_at
`;

const CALL_DISPOSITION_COLUMNS = `
  id, tenant_id, call_id, queue_id, agent_profile_id, disposition_code_id,
  disposition_code, disposition_label, note_text, created_by, updated_by, created_at, updated_at
`;

const QA_SCORECARD_COLUMNS = `
  id, tenant_id, name, description, status, criteria_json, created_by, created_at, updated_at
`;

const QA_REVIEW_COLUMNS = `
  id, tenant_id, call_id, queue_id, agent_profile_id, recording_id, disposition_id,
  scorecard_id, reviewer_user_id, status, scores_json, note_text, total_score, max_score,
  completed_at, acknowledged_at, created_at, updated_at
`;

export class ContactCenterRepository {
  constructor(private readonly db: Pool) {}

  async listQueuesWithPolicies(tenantId: string): Promise<QueuePolicyRow[]> {
    const result = await this.db.query<QueuePolicyRow>(
      `SELECT q.id AS queue_id,
              q.name AS queue_name,
              COUNT(qm.id)::int AS member_count,
              COALESCE(p.answer_target_seconds, 20) AS answer_target_seconds,
              COALESCE(p.answer_rate_target_percent, 80) AS answer_rate_target_percent,
              COALESCE(p.abandonment_threshold_percent, 10) AS abandonment_threshold_percent,
              COALESCE(p.wallboard_enabled, TRUE) AS wallboard_enabled
       FROM queues q
       LEFT JOIN queue_members qm ON qm.queue_id = q.id
       LEFT JOIN queue_sla_policies p ON p.queue_id = q.id AND p.tenant_id = q.tenant_id
       WHERE q.tenant_id = $1 AND q.status = 'active'
       GROUP BY q.id, q.name, p.answer_target_seconds, p.answer_rate_target_percent,
                p.abandonment_threshold_percent, p.wallboard_enabled
       ORDER BY q.name`,
      [tenantId],
    );
    return result.rows;
  }

  async listAgentAvailabilityCounts(tenantId: string): Promise<AgentAvailabilityCountRow[]> {
    const result = await this.db.query<AgentAvailabilityCountRow>(
      `SELECT state, COUNT(*)::int AS count
       FROM agent_availability
       WHERE tenant_id = $1
       GROUP BY state`,
      [tenantId],
    );
    return result.rows;
  }

  async listQueueAgentAvailabilityCounts(tenantId: string): Promise<Array<{ queue_id: string; state: AgentAvailabilityCountRow['state']; count: number }>> {
    const result = await this.db.query<Array<{ queue_id: string; state: AgentAvailabilityCountRow['state']; count: number }>[number]>(
      `SELECT qm.queue_id, a.state, COUNT(*)::int AS count
       FROM queue_members qm
       JOIN extensions e ON e.id = qm.extension_id AND e.tenant_id = qm.tenant_id
       JOIN agent_profiles p ON p.user_id = e.owner_user_id AND p.tenant_id = qm.tenant_id AND p.status = 'active'
       JOIN agent_availability a ON a.agent_profile_id = p.id AND a.tenant_id = qm.tenant_id
       WHERE qm.tenant_id = $1
       GROUP BY qm.queue_id, a.state`,
      [tenantId],
    );
    return result.rows;
  }

  async listRecentCallEvents(tenantId: string): Promise<RawCallEventRow[]> {
    const result = await this.db.query<RawCallEventRow>(
      `SELECT call_id, event_type, event_time, payload
       FROM call_events
       WHERE tenant_id = $1
         AND event_time >= NOW() - INTERVAL '24 hours'
       ORDER BY call_id, event_time ASC`,
      [tenantId],
    );
    return result.rows;
  }

  async getQueueSlaPolicy(queueId: string, tenantId: string): Promise<QueueSlaPolicy | null> {
    const result = await this.db.query<QueueSlaPolicy>(
      `SELECT id, tenant_id, queue_id, answer_target_seconds, answer_rate_target_percent,
              abandonment_threshold_percent, wallboard_enabled, created_at, updated_at
       FROM queue_sla_policies
       WHERE queue_id = $1 AND tenant_id = $2`,
      [queueId, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async upsertQueueSlaPolicy(
    queueId: string,
    tenantId: string,
    input: Partial<Pick<QueueSlaPolicy, 'answer_target_seconds' | 'answer_rate_target_percent' | 'abandonment_threshold_percent' | 'wallboard_enabled'>>,
  ): Promise<QueueSlaPolicy> {
    const current = await this.getQueueSlaPolicy(queueId, tenantId);
    const result = await this.db.query<QueueSlaPolicy>(
      `INSERT INTO queue_sla_policies
         (tenant_id, queue_id, answer_target_seconds, answer_rate_target_percent, abandonment_threshold_percent, wallboard_enabled)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id, queue_id) DO UPDATE
         SET answer_target_seconds = EXCLUDED.answer_target_seconds,
             answer_rate_target_percent = EXCLUDED.answer_rate_target_percent,
             abandonment_threshold_percent = EXCLUDED.abandonment_threshold_percent,
             wallboard_enabled = EXCLUDED.wallboard_enabled,
             updated_at = NOW()
       RETURNING id, tenant_id, queue_id, answer_target_seconds, answer_rate_target_percent,
                 abandonment_threshold_percent, wallboard_enabled, created_at, updated_at`,
      [
        tenantId,
        queueId,
        input.answer_target_seconds ?? current?.answer_target_seconds ?? 20,
        input.answer_rate_target_percent ?? current?.answer_rate_target_percent ?? 80,
        input.abandonment_threshold_percent ?? current?.abandonment_threshold_percent ?? 10,
        input.wallboard_enabled ?? current?.wallboard_enabled ?? true,
      ],
    );
    return result.rows[0]!;
  }

  async queueExists(queueId: string, tenantId: string): Promise<boolean> {
    const result = await this.db.query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM queues WHERE id = $1 AND tenant_id = $2) AS exists`,
      [queueId, tenantId],
    );
    return result.rows[0]?.exists ?? false;
  }

  async agentProfileExists(agentProfileId: string, tenantId: string): Promise<boolean> {
    const result = await this.db.query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM agent_profiles WHERE id = $1 AND tenant_id = $2) AS exists`,
      [agentProfileId, tenantId],
    );
    return result.rows[0]?.exists ?? false;
  }

  async recordingExists(recordingId: string, tenantId: string): Promise<boolean> {
    const result = await this.db.query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM call_recordings WHERE id = $1 AND tenant_id = $2) AS exists`,
      [recordingId, tenantId],
    );
    return result.rows[0]?.exists ?? false;
  }

  async listDispositionCodes(tenantId: string): Promise<DispositionCode[]> {
    const result = await this.db.query<DispositionCode>(
      `SELECT ${DISPOSITION_COLUMNS}
       FROM call_disposition_codes
       WHERE tenant_id = $1
       ORDER BY sort_order, created_at`,
      [tenantId],
    );
    return result.rows;
  }

  async findDispositionCodeById(id: string, tenantId: string): Promise<DispositionCode | null> {
    const result = await this.db.query<DispositionCode>(
      `SELECT ${DISPOSITION_COLUMNS}
       FROM call_disposition_codes
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async createDispositionCode(
    tenantId: string,
    input: Pick<DispositionCode, 'queue_id' | 'code' | 'label' | 'description' | 'sort_order' | 'status'>,
  ): Promise<DispositionCode> {
    const result = await this.db.query<DispositionCode>(
      `INSERT INTO call_disposition_codes
         (tenant_id, queue_id, code, label, description, sort_order, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${DISPOSITION_COLUMNS}`,
      [tenantId, input.queue_id, input.code, input.label, input.description, input.sort_order, input.status],
    );
    return result.rows[0]!;
  }

  async updateDispositionCode(
    id: string,
    tenantId: string,
    input: Partial<Pick<DispositionCode, 'queue_id' | 'code' | 'label' | 'description' | 'sort_order' | 'status'>>,
  ): Promise<DispositionCode | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const [key, value] of Object.entries(input)) {
      fields.push(`${key} = $${idx++}`);
      values.push(value);
    }
    if (fields.length === 0) {
      return this.findDispositionCodeById(id, tenantId);
    }
    values.push(id, tenantId);
    const result = await this.db.query<DispositionCode>(
      `UPDATE call_disposition_codes
       SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${idx++} AND tenant_id = $${idx}
       RETURNING ${DISPOSITION_COLUMNS}`,
      values,
    );
    return result.rows[0] ?? null;
  }

  async findCallDisposition(callId: string, tenantId: string): Promise<CallDisposition | null> {
    const result = await this.db.query<CallDisposition>(
      `SELECT ${CALL_DISPOSITION_COLUMNS}
       FROM call_dispositions
       WHERE call_id = $1 AND tenant_id = $2`,
      [callId, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async upsertCallDisposition(
    tenantId: string,
    callId: string,
    actorId: string,
    input: {
      queue_id: string | null;
      agent_profile_id: string | null;
      disposition_code_id: string | null;
      disposition_code: string | null;
      disposition_label: string | null;
      note_text: string | null;
    },
  ): Promise<CallDisposition> {
    const result = await this.db.query<CallDisposition>(
      `INSERT INTO call_dispositions
         (tenant_id, call_id, queue_id, agent_profile_id, disposition_code_id, disposition_code, disposition_label, note_text, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
       ON CONFLICT (tenant_id, call_id) DO UPDATE
         SET queue_id = EXCLUDED.queue_id,
             agent_profile_id = EXCLUDED.agent_profile_id,
             disposition_code_id = EXCLUDED.disposition_code_id,
             disposition_code = EXCLUDED.disposition_code,
             disposition_label = EXCLUDED.disposition_label,
             note_text = EXCLUDED.note_text,
             updated_by = EXCLUDED.updated_by,
             updated_at = NOW()
       RETURNING ${CALL_DISPOSITION_COLUMNS}`,
      [
        tenantId,
        callId,
        input.queue_id,
        input.agent_profile_id,
        input.disposition_code_id,
        input.disposition_code,
        input.disposition_label,
        input.note_text,
        actorId,
      ],
    );
    return result.rows[0]!;
  }

  async listDispositionUsage(tenantId: string): Promise<DispositionUsageRow[]> {
    const result = await this.db.query<DispositionUsageRow>(
      `SELECT d.disposition_code_id,
              d.disposition_code,
              d.disposition_label,
              d.queue_id,
              q.name AS queue_name,
              COUNT(*)::int AS usage_count,
              MAX(d.updated_at) AS last_used_at
       FROM call_dispositions d
       LEFT JOIN queues q ON q.id = d.queue_id
       WHERE d.tenant_id = $1
         AND d.updated_at >= NOW() - INTERVAL '24 hours'
       GROUP BY d.disposition_code_id, d.disposition_code, d.disposition_label, d.queue_id, q.name
       ORDER BY usage_count DESC, disposition_label NULLS LAST`,
      [tenantId],
    );
    return result.rows;
  }

  async listQaScorecards(tenantId: string): Promise<QaScorecard[]> {
    const result = await this.db.query<QaScorecard>(
      `SELECT ${QA_SCORECARD_COLUMNS}
       FROM qa_scorecards
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows;
  }

  async findQaScorecardById(id: string, tenantId: string): Promise<QaScorecard | null> {
    const result = await this.db.query<QaScorecard>(
      `SELECT ${QA_SCORECARD_COLUMNS}
       FROM qa_scorecards
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async createQaScorecard(
    tenantId: string,
    actorId: string,
    input: Pick<QaScorecard, 'name' | 'description' | 'status' | 'criteria_json'>,
  ): Promise<QaScorecard> {
    const result = await this.db.query<QaScorecard>(
      `INSERT INTO qa_scorecards (tenant_id, name, description, status, criteria_json, created_by)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       RETURNING ${QA_SCORECARD_COLUMNS}`,
      [tenantId, input.name, input.description, input.status, JSON.stringify(input.criteria_json), actorId],
    );
    return result.rows[0]!;
  }

  async updateQaScorecard(
    id: string,
    tenantId: string,
    input: Partial<Pick<QaScorecard, 'name' | 'description' | 'status' | 'criteria_json'>>,
  ): Promise<QaScorecard | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const [key, value] of Object.entries(input)) {
      if (key === 'criteria_json') {
        fields.push(`${key} = $${idx++}::jsonb`);
        values.push(JSON.stringify(value));
      } else {
        fields.push(`${key} = $${idx++}`);
        values.push(value);
      }
    }
    if (fields.length === 0) {
      return this.findQaScorecardById(id, tenantId);
    }
    values.push(id, tenantId);
    const result = await this.db.query<QaScorecard>(
      `UPDATE qa_scorecards
       SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${idx++} AND tenant_id = $${idx}
       RETURNING ${QA_SCORECARD_COLUMNS}`,
      values,
    );
    return result.rows[0] ?? null;
  }

  async listQaReviews(tenantId: string): Promise<QaReview[]> {
    const result = await this.db.query<QaReview>(
      `SELECT ${QA_REVIEW_COLUMNS}
       FROM qa_reviews
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows;
  }

  async findQaReviewById(id: string, tenantId: string): Promise<QaReview | null> {
    const result = await this.db.query<QaReview>(
      `SELECT ${QA_REVIEW_COLUMNS}
       FROM qa_reviews
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async createQaReview(
    tenantId: string,
    actorId: string,
    input: Omit<QaReview, 'id' | 'tenant_id' | 'reviewer_user_id' | 'created_at' | 'updated_at' | 'completed_at' | 'acknowledged_at'>,
  ): Promise<QaReview> {
    const result = await this.db.query<QaReview>(
      `INSERT INTO qa_reviews
         (tenant_id, call_id, queue_id, agent_profile_id, recording_id, disposition_id, scorecard_id,
          reviewer_user_id, status, scores_json, note_text, total_score, max_score, completed_at, acknowledged_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13,
               CASE WHEN $9 = 'completed' THEN NOW() ELSE NULL END,
               CASE WHEN $9 = 'acknowledged' THEN NOW() ELSE NULL END)
       RETURNING ${QA_REVIEW_COLUMNS}`,
      [
        tenantId,
        input.call_id,
        input.queue_id,
        input.agent_profile_id,
        input.recording_id,
        input.disposition_id,
        input.scorecard_id,
        actorId,
        input.status,
        JSON.stringify(input.scores_json),
        input.note_text,
        input.total_score,
        input.max_score,
      ],
    );
    return result.rows[0]!;
  }

  async updateQaReview(
    id: string,
    tenantId: string,
    input: Partial<Pick<QaReview, 'queue_id' | 'agent_profile_id' | 'recording_id' | 'disposition_id' | 'status' | 'scores_json' | 'note_text' | 'total_score' | 'max_score'>>,
  ): Promise<QaReview | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, value] of Object.entries(input)) {
      if (key === 'scores_json') {
        fields.push(`${key} = $${idx++}::jsonb`);
        values.push(JSON.stringify(value));
      } else {
        fields.push(`${key} = $${idx++}`);
        values.push(value);
      }
    }

    if ('status' in input) {
      fields.push(`completed_at = CASE WHEN $${idx - 1} = 'completed' THEN NOW() ELSE completed_at END`);
      fields.push(`acknowledged_at = CASE WHEN $${idx - 1} = 'acknowledged' THEN NOW() ELSE acknowledged_at END`);
    }

    if (fields.length === 0) {
      return this.findQaReviewById(id, tenantId);
    }

    values.push(id, tenantId);
    const result = await this.db.query<QaReview>(
      `UPDATE qa_reviews
       SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${idx++} AND tenant_id = $${idx}
       RETURNING ${QA_REVIEW_COLUMNS}`,
      values,
    );
    return result.rows[0] ?? null;
  }

  async getQaSummary(tenantId: string): Promise<{ open_reviews: number; completed_reviews_7d: number; average_score_percent_7d: number | null }> {
    const result = await this.db.query<{
      open_reviews: number;
      completed_reviews_7d: number;
      average_score_percent_7d: number | null;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE status != 'acknowledged')::int AS open_reviews,
         COUNT(*) FILTER (WHERE status IN ('completed', 'acknowledged') AND created_at >= NOW() - INTERVAL '7 days')::int AS completed_reviews_7d,
         ROUND(AVG(CASE WHEN max_score > 0 AND status IN ('completed', 'acknowledged') AND created_at >= NOW() - INTERVAL '7 days'
           THEN (total_score::numeric / max_score::numeric) * 100
           ELSE NULL
         END), 2) AS average_score_percent_7d
       FROM qa_reviews
       WHERE tenant_id = $1`,
      [tenantId],
    );
    return result.rows[0] ?? { open_reviews: 0, completed_reviews_7d: 0, average_score_percent_7d: null };
  }
}

export type {
  AgentAvailabilityCountRow,
  QueuePolicyRow,
  RawCallEventRow,
};
