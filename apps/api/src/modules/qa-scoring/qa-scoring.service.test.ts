import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QaScoringService, QaTemplateNotFoundError, QaReviewNotFoundError, QaReviewValidationError, QaCriterionNotFoundError } from './qa-scoring.service.js';
import type { QaScoringRepository } from './qa-scoring.repository.js';
import type { QaScorecardTemplate, QaScorecardCriterion, QaReview } from './qa-scoring.types.js';

function makeTemplate(overrides: Partial<QaScorecardTemplate> = {}): QaScorecardTemplate {
  return {
    id: 'tmpl-1', tenant_id: 't1', name: 'Standard QA', description: null,
    is_active: true, created_at: new Date(), updated_at: new Date(), ...overrides,
  };
}

function makeCriterion(overrides: Partial<QaScorecardCriterion> = {}): QaScorecardCriterion {
  return {
    id: 'crit-1', tenant_id: 't1', template_id: 'tmpl-1', label: 'Greeting',
    description: null, max_score: 10, weight: 1.0, display_order: 0,
    created_at: new Date(), updated_at: new Date(), ...overrides,
  };
}

function makeReview(overrides: Partial<QaReview> = {}): QaReview {
  return {
    id: 'rev-1', tenant_id: 't1', template_id: 'tmpl-1', call_id: 'call-1',
    recording_id: null, reviewer_user_id: 'user-1', agent_profile_id: null,
    status: 'draft', overall_score: null, notes: null,
    disputed_by: null, disputed_at: null, dispute_reason: null,
    finalized_by: null, finalized_at: null, created_at: new Date(), updated_at: new Date(),
    ...overrides,
  };
}

function makeRepo(): QaScoringRepository {
  return {
    listTemplates: vi.fn(),
    findTemplateById: vi.fn(),
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    listCriteria: vi.fn(),
    findCriterionById: vi.fn(),
    createCriterion: vi.fn(),
    updateCriterion: vi.fn(),
    deleteCriterion: vi.fn(),
    listReviews: vi.fn(),
    findReviewById: vi.fn(),
    findReviewWithScores: vi.fn(),
    createReview: vi.fn(),
    submitReview: vi.fn(),
    disputeReview: vi.fn(),
    finalizeReview: vi.fn(),
  } as unknown as QaScoringRepository;
}

describe('QaScoringService', () => {
  let repo: QaScoringRepository;
  let service: QaScoringService;

  beforeEach(() => {
    repo = makeRepo();
    service = new QaScoringService(repo);
  });

  describe('createTemplate', () => {
    it('throws for empty name', async () => {
      await expect(service.createTemplate({ tenant_id: 't1', name: '  ' }))
        .rejects.toThrow(QaReviewValidationError);
    });

    it('creates template', async () => {
      const tmpl = makeTemplate();
      vi.mocked(repo.createTemplate).mockResolvedValue(tmpl);
      expect(await service.createTemplate({ tenant_id: 't1', name: 'Standard QA' })).toBe(tmpl);
    });
  });

  describe('createCriterion', () => {
    it('throws when template not found', async () => {
      vi.mocked(repo.findTemplateById).mockResolvedValue(null);
      await expect(service.createCriterion({ tenant_id: 't1', template_id: 'x', label: 'L' }))
        .rejects.toThrow(QaTemplateNotFoundError);
    });

    it('throws for empty label', async () => {
      vi.mocked(repo.findTemplateById).mockResolvedValue(makeTemplate());
      await expect(service.createCriterion({ tenant_id: 't1', template_id: 'tmpl-1', label: '' }))
        .rejects.toThrow(QaReviewValidationError);
    });
  });

  describe('deleteCriterion', () => {
    it('throws not found', async () => {
      vi.mocked(repo.deleteCriterion).mockResolvedValue(false);
      await expect(service.deleteCriterion('id', 't1')).rejects.toThrow(QaCriterionNotFoundError);
    });
  });

  describe('submitReview', () => {
    it('throws when review not found', async () => {
      vi.mocked(repo.findReviewById).mockResolvedValue(null);
      await expect(service.submitReview('id', 't1', { scores: [{ criterion_id: 'c', score: 5 }] }))
        .rejects.toThrow(QaReviewNotFoundError);
    });

    it('throws when already submitted', async () => {
      vi.mocked(repo.findReviewById).mockResolvedValue(makeReview({ status: 'submitted' }));
      await expect(service.submitReview('rev-1', 't1', { scores: [{ criterion_id: 'c', score: 5 }] }))
        .rejects.toThrow(QaReviewValidationError);
    });

    it('throws when no scores provided', async () => {
      vi.mocked(repo.findReviewById).mockResolvedValue(makeReview());
      await expect(service.submitReview('rev-1', 't1', { scores: [] }))
        .rejects.toThrow(QaReviewValidationError);
    });

    it('throws when score out of range', async () => {
      vi.mocked(repo.findReviewById).mockResolvedValue(makeReview());
      vi.mocked(repo.listCriteria).mockResolvedValue([makeCriterion({ id: 'crit-1', max_score: 10 })]);
      await expect(service.submitReview('rev-1', 't1', { scores: [{ criterion_id: 'crit-1', score: 15 }] }))
        .rejects.toThrow(QaReviewValidationError);
    });

    it('computes overall score correctly', async () => {
      const criteria = [
        makeCriterion({ id: 'c1', max_score: 10, weight: 2.0 }),
        makeCriterion({ id: 'c2', max_score: 5, weight: 1.0 }),
      ];
      vi.mocked(repo.findReviewById).mockResolvedValue(makeReview());
      vi.mocked(repo.listCriteria).mockResolvedValue(criteria);
      vi.mocked(repo.submitReview).mockResolvedValue(makeReview({ status: 'submitted', overall_score: 80 }));
      vi.mocked(repo.findReviewWithScores).mockResolvedValue({ ...makeReview({ status: 'submitted' }), scores: [] });
      await service.submitReview('rev-1', 't1', {
        scores: [{ criterion_id: 'c1', score: 8 }, { criterion_id: 'c2', score: 4 }],
      });
      const call = vi.mocked(repo.submitReview).mock.calls[0]!;
      // (8/10)*2 + (4/5)*1 = 1.6 + 0.8 = 2.4 / 3 = 0.8 → 80.00
      expect(call[2]).toBeCloseTo(80, 1);
    });
  });

  describe('disputeReview', () => {
    it('throws when not submitted', async () => {
      vi.mocked(repo.findReviewById).mockResolvedValue(makeReview({ status: 'draft' }));
      await expect(service.disputeReview('rev-1', 't1', 'user-1', { dispute_reason: 'Wrong' }))
        .rejects.toThrow(QaReviewValidationError);
    });

    it('throws for empty reason', async () => {
      vi.mocked(repo.findReviewById).mockResolvedValue(makeReview({ status: 'submitted' }));
      await expect(service.disputeReview('rev-1', 't1', 'user-1', { dispute_reason: '  ' }))
        .rejects.toThrow(QaReviewValidationError);
    });
  });

  describe('finalizeReview', () => {
    it('allows finalization from submitted', async () => {
      const finalized = makeReview({ status: 'finalized' });
      vi.mocked(repo.findReviewById).mockResolvedValue(makeReview({ status: 'submitted' }));
      vi.mocked(repo.finalizeReview).mockResolvedValue(finalized);
      expect(await service.finalizeReview('rev-1', 't1', 'user-1')).toBe(finalized);
    });

    it('throws when already finalized', async () => {
      vi.mocked(repo.findReviewById).mockResolvedValue(makeReview({ status: 'finalized' }));
      await expect(service.finalizeReview('rev-1', 't1', 'user-1'))
        .rejects.toThrow(QaReviewValidationError);
    });
  });
});
