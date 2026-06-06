import type { QaScoringRepository } from './qa-scoring.repository.js';
import type {
  CreateQaCriterionInput,
  CreateQaReviewInput,
  CreateQaTemplateInput,
  DisputeQaReviewInput,
  QaReview,
  QaReviewWithScores,
  QaScorecardCriterion,
  QaScorecardTemplate,
  ScoreInput,
  SubmitQaReviewInput,
  UpdateQaCriterionInput,
  UpdateQaTemplateInput,
} from './qa-scoring.types.js';

export class QaTemplateNotFoundError extends Error {}
export class QaCriterionNotFoundError extends Error {}
export class QaReviewNotFoundError extends Error {}
export class QaReviewValidationError extends Error {}

export class QaScoringService {
  constructor(private readonly repo: QaScoringRepository) {}

  // ── Templates ──────────────────────────────────────────────────────────────

  async listTemplates(tenantId: string): Promise<QaScorecardTemplate[]> {
    return this.repo.listTemplates(tenantId);
  }

  async getTemplate(id: string, tenantId: string): Promise<QaScorecardTemplate> {
    const t = await this.repo.findTemplateById(id, tenantId);
    if (!t) throw new QaTemplateNotFoundError(`QA template ${id} not found`);
    return t;
  }

  async createTemplate(input: CreateQaTemplateInput): Promise<QaScorecardTemplate> {
    if (!input.name.trim()) throw new QaReviewValidationError('Template name must not be empty');
    return this.repo.createTemplate(input);
  }

  async updateTemplate(id: string, tenantId: string, input: UpdateQaTemplateInput): Promise<QaScorecardTemplate> {
    if (input.name !== undefined && !input.name.trim()) {
      throw new QaReviewValidationError('Template name must not be empty');
    }
    const t = await this.repo.updateTemplate(id, tenantId, input);
    if (!t) throw new QaTemplateNotFoundError(`QA template ${id} not found`);
    return t;
  }

  // ── Criteria ───────────────────────────────────────────────────────────────

  async listCriteria(templateId: string, tenantId: string): Promise<QaScorecardCriterion[]> {
    await this.getTemplate(templateId, tenantId);
    return this.repo.listCriteria(templateId, tenantId);
  }

  async createCriterion(input: CreateQaCriterionInput): Promise<QaScorecardCriterion> {
    await this.getTemplate(input.template_id, input.tenant_id);
    if (!input.label.trim()) throw new QaReviewValidationError('Criterion label must not be empty');
    return this.repo.createCriterion(input);
  }

  async updateCriterion(id: string, tenantId: string, input: UpdateQaCriterionInput): Promise<QaScorecardCriterion> {
    const c = await this.repo.updateCriterion(id, tenantId, input);
    if (!c) throw new QaCriterionNotFoundError(`QA criterion ${id} not found`);
    return c;
  }

  async deleteCriterion(id: string, tenantId: string): Promise<void> {
    const deleted = await this.repo.deleteCriterion(id, tenantId);
    if (!deleted) throw new QaCriterionNotFoundError(`QA criterion ${id} not found`);
  }

  // ── Reviews ────────────────────────────────────────────────────────────────

  async listReviews(tenantId: string, filters: { call_id?: string; agent_profile_id?: string; status?: string }): Promise<QaReview[]> {
    return this.repo.listReviews(tenantId, filters);
  }

  async getReview(id: string, tenantId: string): Promise<QaReviewWithScores> {
    const r = await this.repo.findReviewWithScores(id, tenantId);
    if (!r) throw new QaReviewNotFoundError(`QA review ${id} not found`);
    return r;
  }

  async createReview(input: CreateQaReviewInput, reviewerUserId: string): Promise<QaReview> {
    await this.getTemplate(input.template_id, input.tenant_id);
    return this.repo.createReview(input, reviewerUserId);
  }

  async submitReview(id: string, tenantId: string, input: SubmitQaReviewInput): Promise<QaReviewWithScores> {
    const review = await this.repo.findReviewById(id, tenantId);
    if (!review) throw new QaReviewNotFoundError(`QA review ${id} not found`);
    if (review.status !== 'draft') {
      throw new QaReviewValidationError(`Review is already ${review.status} and cannot be submitted`);
    }
    if (input.scores.length === 0) {
      throw new QaReviewValidationError('At least one score is required to submit a review');
    }

    const criteria = await this.repo.listCriteria(review.template_id, tenantId);
    this.validateScores(input.scores, criteria.map((c) => ({ id: c.id, max_score: c.max_score })));
    const overallScore = this.computeOverallScore(input.scores, criteria);

    const updated = await this.repo.submitReview(id, tenantId, overallScore, input.notes ?? null, input.scores);
    if (!updated) throw new QaReviewValidationError('Review could not be submitted (concurrent update)');
    return this.getReview(id, tenantId);
  }

  async disputeReview(id: string, tenantId: string, disputedBy: string, input: DisputeQaReviewInput): Promise<QaReview> {
    const review = await this.repo.findReviewById(id, tenantId);
    if (!review) throw new QaReviewNotFoundError(`QA review ${id} not found`);
    if (review.status !== 'submitted') {
      throw new QaReviewValidationError(`Only submitted reviews can be disputed (current: ${review.status})`);
    }
    if (!input.dispute_reason.trim()) throw new QaReviewValidationError('Dispute reason must not be empty');
    const updated = await this.repo.disputeReview(id, tenantId, disputedBy, input.dispute_reason);
    if (!updated) throw new QaReviewValidationError('Review could not be disputed (concurrent update)');
    return updated;
  }

  async finalizeReview(id: string, tenantId: string, finalizedBy: string): Promise<QaReview> {
    const review = await this.repo.findReviewById(id, tenantId);
    if (!review) throw new QaReviewNotFoundError(`QA review ${id} not found`);
    if (review.status !== 'submitted' && review.status !== 'disputed') {
      throw new QaReviewValidationError(`Only submitted or disputed reviews can be finalized (current: ${review.status})`);
    }
    const updated = await this.repo.finalizeReview(id, tenantId, finalizedBy);
    if (!updated) throw new QaReviewValidationError('Review could not be finalized (concurrent update)');
    return updated;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private validateScores(scores: ScoreInput[], criteria: Array<{ id: string; max_score: number }>): void {
    const criteriaMap = new Map(criteria.map((c) => [c.id, c.max_score]));
    for (const s of scores) {
      const maxScore = criteriaMap.get(s.criterion_id);
      if (maxScore === undefined) {
        throw new QaReviewValidationError(`Criterion ${s.criterion_id} not found in template`);
      }
      if (s.score < 0 || s.score > maxScore) {
        throw new QaReviewValidationError(`Score ${s.score} for criterion ${s.criterion_id} is out of range (0–${maxScore})`);
      }
    }
  }

  private computeOverallScore(scores: ScoreInput[], criteria: QaScorecardCriterion[]): number {
    const criteriaMap = new Map(criteria.map((c) => [c.id, c]));
    let weightedSum = 0;
    let totalWeight = 0;
    for (const s of scores) {
      const c = criteriaMap.get(s.criterion_id);
      if (!c) continue;
      const pct = c.max_score > 0 ? s.score / c.max_score : 0;
      weightedSum += pct * Number(c.weight);
      totalWeight += Number(c.weight);
    }
    if (totalWeight === 0) return 0;
    return Math.round((weightedSum / totalWeight) * 100 * 100) / 100;
  }
}
