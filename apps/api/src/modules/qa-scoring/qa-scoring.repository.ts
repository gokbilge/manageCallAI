import type { Pool } from 'pg';
import type {
  CreateQaCriterionInput,
  CreateQaReviewInput,
  CreateQaTemplateInput,
  QaReview,
  QaReviewScore,
  QaReviewWithScores,
  QaScorecardCriterion,
  QaScorecardTemplate,
  ScoreInput,
  UpdateQaCriterionInput,
  UpdateQaTemplateInput,
} from './qa-scoring.types.js';

export class QaScoringRepository {
  constructor(private readonly db: Pool) {}

  // ── Templates ──────────────────────────────────────────────────────────────

  async listTemplates(tenantId: string): Promise<QaScorecardTemplate[]> {
    const result = await this.db.query<QaScorecardTemplate>(
      'SELECT * FROM qa_scorecard_templates WHERE tenant_id = $1 ORDER BY name',
      [tenantId],
    );
    return result.rows;
  }

  async findTemplateById(id: string, tenantId: string): Promise<QaScorecardTemplate | null> {
    const result = await this.db.query<QaScorecardTemplate>(
      'SELECT * FROM qa_scorecard_templates WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async createTemplate(input: CreateQaTemplateInput): Promise<QaScorecardTemplate> {
    const result = await this.db.query<QaScorecardTemplate>(
      `INSERT INTO qa_scorecard_templates (tenant_id, name, description)
       VALUES ($1, $2, $3) RETURNING *`,
      [input.tenant_id, input.name, input.description ?? null],
    );
    return result.rows[0]!;
  }

  async updateTemplate(id: string, tenantId: string, input: UpdateQaTemplateInput): Promise<QaScorecardTemplate | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (input.name !== undefined)        { sets.push(`name = $${idx}`);        params.push(input.name);        idx++; }
    if (input.description !== undefined) { sets.push(`description = $${idx}`); params.push(input.description); idx++; }
    if (input.is_active !== undefined)   { sets.push(`is_active = $${idx}`);   params.push(input.is_active);   idx++; }
    if (sets.length === 0) return this.findTemplateById(id, tenantId);
    sets.push('updated_at = now()');
    params.push(id, tenantId);
    const result = await this.db.query<QaScorecardTemplate>(
      `UPDATE qa_scorecard_templates SET ${sets.join(', ')} WHERE id = $${idx} AND tenant_id = $${idx + 1} RETURNING *`,
      params,
    );
    return result.rows[0] ?? null;
  }

  // ── Criteria ───────────────────────────────────────────────────────────────

  async listCriteria(templateId: string, tenantId: string): Promise<QaScorecardCriterion[]> {
    const result = await this.db.query<QaScorecardCriterion>(
      `SELECT * FROM qa_scorecard_criteria WHERE template_id = $1 AND tenant_id = $2 ORDER BY display_order, label`,
      [templateId, tenantId],
    );
    return result.rows;
  }

  async findCriterionById(id: string, tenantId: string): Promise<QaScorecardCriterion | null> {
    const result = await this.db.query<QaScorecardCriterion>(
      'SELECT * FROM qa_scorecard_criteria WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async createCriterion(input: CreateQaCriterionInput): Promise<QaScorecardCriterion> {
    const result = await this.db.query<QaScorecardCriterion>(
      `INSERT INTO qa_scorecard_criteria (tenant_id, template_id, label, description, max_score, weight, display_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        input.tenant_id,
        input.template_id,
        input.label,
        input.description ?? null,
        input.max_score ?? 10,
        input.weight ?? 1.0,
        input.display_order ?? 0,
      ],
    );
    return result.rows[0]!;
  }

  async updateCriterion(id: string, tenantId: string, input: UpdateQaCriterionInput): Promise<QaScorecardCriterion | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (input.label !== undefined)         { sets.push(`label = $${idx}`);         params.push(input.label);         idx++; }
    if (input.description !== undefined)   { sets.push(`description = $${idx}`);   params.push(input.description);   idx++; }
    if (input.max_score !== undefined)     { sets.push(`max_score = $${idx}`);     params.push(input.max_score);     idx++; }
    if (input.weight !== undefined)        { sets.push(`weight = $${idx}`);        params.push(input.weight);        idx++; }
    if (input.display_order !== undefined) { sets.push(`display_order = $${idx}`); params.push(input.display_order); idx++; }
    if (sets.length === 0) return this.findCriterionById(id, tenantId);
    sets.push('updated_at = now()');
    params.push(id, tenantId);
    const result = await this.db.query<QaScorecardCriterion>(
      `UPDATE qa_scorecard_criteria SET ${sets.join(', ')} WHERE id = $${idx} AND tenant_id = $${idx + 1} RETURNING *`,
      params,
    );
    return result.rows[0] ?? null;
  }

  async deleteCriterion(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db.query(
      'DELETE FROM qa_scorecard_criteria WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ── Reviews ────────────────────────────────────────────────────────────────

  async listReviews(tenantId: string, filters: { call_id?: string; agent_profile_id?: string; status?: string }): Promise<QaReview[]> {
    const conditions = ['tenant_id = $1'];
    const params: unknown[] = [tenantId];
    let idx = 2;
    if (filters.call_id) { conditions.push(`call_id = $${idx}`); params.push(filters.call_id); idx++; }
    if (filters.agent_profile_id) { conditions.push(`agent_profile_id = $${idx}`); params.push(filters.agent_profile_id); idx++; }
    if (filters.status) { conditions.push(`status = $${idx}`); params.push(filters.status); idx++; }
    const result = await this.db.query<QaReview>(
      `SELECT * FROM qa_reviews WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
      params,
    );
    return result.rows;
  }

  async findReviewById(id: string, tenantId: string): Promise<QaReview | null> {
    const result = await this.db.query<QaReview>(
      'SELECT * FROM qa_reviews WHERE id = $1 AND tenant_id = $2',
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async findReviewWithScores(id: string, tenantId: string): Promise<QaReviewWithScores | null> {
    const review = await this.findReviewById(id, tenantId);
    if (!review) return null;
    const scoresResult = await this.db.query<QaReviewScore>(
      'SELECT * FROM qa_review_scores WHERE review_id = $1 AND tenant_id = $2',
      [id, tenantId],
    );
    return { ...review, scores: scoresResult.rows };
  }

  async createReview(input: CreateQaReviewInput, reviewerUserId: string): Promise<QaReview> {
    const result = await this.db.query<QaReview>(
      `INSERT INTO qa_reviews (tenant_id, template_id, call_id, recording_id, reviewer_user_id, agent_profile_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        input.tenant_id,
        input.template_id,
        input.call_id,
        input.recording_id ?? null,
        reviewerUserId,
        input.agent_profile_id ?? null,
        input.notes ?? null,
      ],
    );
    return result.rows[0]!;
  }

  async submitReview(id: string, tenantId: string, overallScore: number, notes: string | null, scores: ScoreInput[]): Promise<QaReview | null> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      for (const s of scores) {
        await client.query(
          `INSERT INTO qa_review_scores (tenant_id, review_id, criterion_id, score, comment)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (review_id, criterion_id)
           DO UPDATE SET score = EXCLUDED.score, comment = EXCLUDED.comment, updated_at = now()`,
          [tenantId, id, s.criterion_id, s.score, s.comment ?? null],
        );
      }
      const result = await client.query<QaReview>(
        `UPDATE qa_reviews SET status = 'submitted', overall_score = $1, notes = $2, updated_at = now()
         WHERE id = $3 AND tenant_id = $4 AND status = 'draft'
         RETURNING *`,
        [overallScore, notes, id, tenantId],
      );
      await client.query('COMMIT');
      return result.rows[0] ?? null;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async disputeReview(id: string, tenantId: string, disputedBy: string, reason: string): Promise<QaReview | null> {
    const result = await this.db.query<QaReview>(
      `UPDATE qa_reviews SET status = 'disputed', disputed_by = $1, disputed_at = now(), dispute_reason = $2, updated_at = now()
       WHERE id = $3 AND tenant_id = $4 AND status = 'submitted'
       RETURNING *`,
      [disputedBy, reason, id, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async finalizeReview(id: string, tenantId: string, finalizedBy: string): Promise<QaReview | null> {
    const result = await this.db.query<QaReview>(
      `UPDATE qa_reviews SET status = 'finalized', finalized_by = $1, finalized_at = now(), updated_at = now()
       WHERE id = $2 AND tenant_id = $3 AND status IN ('submitted', 'disputed')
       RETURNING *`,
      [finalizedBy, id, tenantId],
    );
    return result.rows[0] ?? null;
  }
}
