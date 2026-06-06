import { z } from '../registry.js';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const QaReviewStatusSchema = z.enum(['draft', 'submitted', 'disputed', 'finalized']);
export type QaReviewStatus = z.infer<typeof QaReviewStatusSchema>;

// ── Resource schemas ──────────────────────────────────────────────────────────
export const QaScorecardTemplateSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('QaScorecardTemplate');
export type QaScorecardTemplate = z.infer<typeof QaScorecardTemplateSchema>;

export const QaScorecardCriterionSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  template_id: z.string().uuid(),
  label: z.string(),
  description: z.string().nullable(),
  max_score: z.number().int(),
  weight: z.number(),
  display_order: z.number().int(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('QaScorecardCriterion');
export type QaScorecardCriterion = z.infer<typeof QaScorecardCriterionSchema>;

export const QaReviewScoreSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  review_id: z.string().uuid(),
  criterion_id: z.string().uuid(),
  score: z.number().int(),
  comment: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('QaReviewScore');
export type QaReviewScore = z.infer<typeof QaReviewScoreSchema>;

export const QaReviewSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  template_id: z.string().uuid(),
  call_id: z.string(),
  recording_id: z.string().uuid().nullable(),
  reviewer_user_id: z.string().uuid(),
  agent_profile_id: z.string().uuid().nullable(),
  status: QaReviewStatusSchema,
  overall_score: z.number().nullable(),
  notes: z.string().nullable(),
  disputed_by: z.string().uuid().nullable(),
  disputed_at: z.string().datetime().nullable(),
  dispute_reason: z.string().nullable(),
  finalized_by: z.string().uuid().nullable(),
  finalized_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('QaReview');
export type QaReview = z.infer<typeof QaReviewSchema>;

// ── Request schemas ───────────────────────────────────────────────────────────
export const CreateQaTemplateBodySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
}).openapi('CreateQaTemplateBody');
export type CreateQaTemplateBody = z.infer<typeof CreateQaTemplateBodySchema>;

export const UpdateQaTemplateBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
}).openapi('UpdateQaTemplateBody');
export type UpdateQaTemplateBody = z.infer<typeof UpdateQaTemplateBodySchema>;

export const CreateQaCriterionBodySchema = z.object({
  label: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  max_score: z.number().int().min(1).max(100).optional(),
  weight: z.number().positive().optional(),
  display_order: z.number().int().min(0).optional(),
}).openapi('CreateQaCriterionBody');
export type CreateQaCriterionBody = z.infer<typeof CreateQaCriterionBodySchema>;

export const UpdateQaCriterionBodySchema = z.object({
  label: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  max_score: z.number().int().min(1).max(100).optional(),
  weight: z.number().positive().optional(),
  display_order: z.number().int().min(0).optional(),
}).openapi('UpdateQaCriterionBody');
export type UpdateQaCriterionBody = z.infer<typeof UpdateQaCriterionBodySchema>;

export const CreateQaReviewBodySchema = z.object({
  template_id: z.string().uuid(),
  call_id: z.string().min(1),
  recording_id: z.string().uuid().nullable().optional(),
  agent_profile_id: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
}).openapi('CreateQaReviewBody');
export type CreateQaReviewBody = z.infer<typeof CreateQaReviewBodySchema>;

export const QaScoreInputSchema = z.object({
  criterion_id: z.string().uuid(),
  score: z.number().int().min(0),
  comment: z.string().nullable().optional(),
}).openapi('QaScoreInput');

export const SubmitQaReviewBodySchema = z.object({
  scores: z.array(QaScoreInputSchema).min(1),
  notes: z.string().nullable().optional(),
}).openapi('SubmitQaReviewBody');
export type SubmitQaReviewBody = z.infer<typeof SubmitQaReviewBodySchema>;

export const DisputeQaReviewBodySchema = z.object({
  dispute_reason: z.string().min(1).max(2000),
}).openapi('DisputeQaReviewBody');
export type DisputeQaReviewBody = z.infer<typeof DisputeQaReviewBodySchema>;
