export type QaReviewStatus = 'draft' | 'submitted' | 'disputed' | 'finalized';

export interface QaScorecardTemplate {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface QaScorecardCriterion {
  id: string;
  tenant_id: string;
  template_id: string;
  label: string;
  description: string | null;
  max_score: number;
  weight: number;
  display_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface QaReview {
  id: string;
  tenant_id: string;
  template_id: string;
  call_id: string;
  recording_id: string | null;
  reviewer_user_id: string;
  agent_profile_id: string | null;
  status: QaReviewStatus;
  overall_score: number | null;
  notes: string | null;
  disputed_by: string | null;
  disputed_at: Date | null;
  dispute_reason: string | null;
  finalized_by: string | null;
  finalized_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface QaReviewScore {
  id: string;
  tenant_id: string;
  review_id: string;
  criterion_id: string;
  score: number;
  comment: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface QaReviewWithScores extends QaReview {
  scores: QaReviewScore[];
}

export interface CreateQaTemplateInput {
  tenant_id: string;
  name: string;
  description?: string | null;
}

export interface UpdateQaTemplateInput {
  name?: string;
  description?: string | null;
  is_active?: boolean;
}

export interface CreateQaCriterionInput {
  tenant_id: string;
  template_id: string;
  label: string;
  description?: string | null;
  max_score?: number;
  weight?: number;
  display_order?: number;
}

export interface UpdateQaCriterionInput {
  label?: string;
  description?: string | null;
  max_score?: number;
  weight?: number;
  display_order?: number;
}

export interface CreateQaReviewInput {
  tenant_id: string;
  template_id: string;
  call_id: string;
  recording_id?: string | null;
  agent_profile_id?: string | null;
  notes?: string | null;
}

export interface ScoreInput {
  criterion_id: string;
  score: number;
  comment?: string | null;
}

export interface SubmitQaReviewInput {
  scores: ScoreInput[];
  notes?: string | null;
}

export interface DisputeQaReviewInput {
  dispute_reason: string;
}
