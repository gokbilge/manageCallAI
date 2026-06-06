import { z } from '../registry.js';

export const QueueSlaPolicySchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  queue_id: z.string().uuid(),
  answer_target_seconds: z.number().int(),
  answer_rate_target_percent: z.number().int(),
  abandonment_threshold_percent: z.number().int(),
  wallboard_enabled: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('QueueSlaPolicy');
export type QueueSlaPolicy = z.infer<typeof QueueSlaPolicySchema>;

export const UpsertQueueSlaPolicyBodySchema = z.object({
  answer_target_seconds: z.number().int().min(1).max(3600).optional(),
  answer_rate_target_percent: z.number().int().min(1).max(100).optional(),
  abandonment_threshold_percent: z.number().int().min(0).max(100).optional(),
  wallboard_enabled: z.boolean().optional(),
}).openapi('UpsertQueueSlaPolicyBody');
export type UpsertQueueSlaPolicyBody = z.infer<typeof UpsertQueueSlaPolicyBodySchema>;

export const DispositionCodeStatusSchema = z.enum(['active', 'inactive']);
export type DispositionCodeStatus = z.infer<typeof DispositionCodeStatusSchema>;

export const DispositionCodeSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  queue_id: z.string().uuid().nullable(),
  code: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  sort_order: z.number().int(),
  status: DispositionCodeStatusSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('DispositionCode');
export type DispositionCode = z.infer<typeof DispositionCodeSchema>;

export const CreateDispositionCodeBodySchema = z.object({
  queue_id: z.string().uuid().nullable().optional(),
  code: z.string().min(1).max(64),
  label: z.string().min(1).max(128),
  description: z.string().max(1000).nullable().optional(),
  sort_order: z.number().int().min(0).max(10_000).optional(),
  status: DispositionCodeStatusSchema.optional(),
}).openapi('CreateDispositionCodeBody');
export type CreateDispositionCodeBody = z.infer<typeof CreateDispositionCodeBodySchema>;

export const UpdateDispositionCodeBodySchema = z.object({
  queue_id: z.string().uuid().nullable().optional(),
  code: z.string().min(1).max(64).optional(),
  label: z.string().min(1).max(128).optional(),
  description: z.string().max(1000).nullable().optional(),
  sort_order: z.number().int().min(0).max(10_000).optional(),
  status: DispositionCodeStatusSchema.optional(),
}).openapi('UpdateDispositionCodeBody');
export type UpdateDispositionCodeBody = z.infer<typeof UpdateDispositionCodeBodySchema>;

export const CallDispositionSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  call_id: z.string(),
  queue_id: z.string().uuid().nullable(),
  agent_profile_id: z.string().uuid().nullable(),
  disposition_code_id: z.string().uuid().nullable(),
  disposition_code: z.string().nullable(),
  disposition_label: z.string().nullable(),
  note_text: z.string().nullable(),
  created_by: z.string().uuid().nullable(),
  updated_by: z.string().uuid().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('CallDisposition');
export type CallDisposition = z.infer<typeof CallDispositionSchema>;

export const UpsertCallDispositionBodySchema = z.object({
  queue_id: z.string().uuid().nullable().optional(),
  agent_profile_id: z.string().uuid().nullable().optional(),
  disposition_code_id: z.string().uuid().nullable().optional(),
  note_text: z.string().max(4000).nullable().optional(),
}).openapi('UpsertCallDispositionBody');
export type UpsertCallDispositionBody = z.infer<typeof UpsertCallDispositionBodySchema>;

export const DispositionUsageRowSchema = z.object({
  disposition_code_id: z.string().uuid().nullable(),
  disposition_code: z.string().nullable(),
  disposition_label: z.string().nullable(),
  queue_id: z.string().uuid().nullable(),
  queue_name: z.string().nullable(),
  usage_count: z.number().int(),
  last_used_at: z.string().datetime().nullable(),
}).openapi('DispositionUsageRow');
export type DispositionUsageRow = z.infer<typeof DispositionUsageRowSchema>;

export const QaScorecardCriterionSchema = z.object({
  key: z.string().min(1).max(64),
  label: z.string().min(1).max(128),
  description: z.string().max(1000).nullable().optional(),
  max_score: z.number().int().min(1).max(100),
});
export type QaScorecardCriterion = z.infer<typeof QaScorecardCriterionSchema>;

export const QaScorecardStatusSchema = z.enum(['active', 'inactive']);
export type QaScorecardStatus = z.infer<typeof QaScorecardStatusSchema>;

export const QaScorecardSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  status: QaScorecardStatusSchema,
  criteria_json: z.array(QaScorecardCriterionSchema),
  created_by: z.string().uuid().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('QaScorecard');
export type QaScorecard = z.infer<typeof QaScorecardSchema>;

export const CreateQaScorecardBodySchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().max(1000).nullable().optional(),
  status: QaScorecardStatusSchema.optional(),
  criteria_json: z.array(QaScorecardCriterionSchema).min(1),
}).openapi('CreateQaScorecardBody');
export type CreateQaScorecardBody = z.infer<typeof CreateQaScorecardBodySchema>;

export const UpdateQaScorecardBodySchema = z.object({
  name: z.string().min(1).max(128).optional(),
  description: z.string().max(1000).nullable().optional(),
  status: QaScorecardStatusSchema.optional(),
  criteria_json: z.array(QaScorecardCriterionSchema).min(1).optional(),
}).openapi('UpdateQaScorecardBody');
export type UpdateQaScorecardBody = z.infer<typeof UpdateQaScorecardBodySchema>;

export const QaReviewStatusSchema = z.enum(['draft', 'completed', 'acknowledged']);
export type QaReviewStatus = z.infer<typeof QaReviewStatusSchema>;

export const QaReviewScoreSchema = z.object({
  key: z.string().min(1).max(64),
  label: z.string().min(1).max(128),
  score: z.number().int().min(0).max(100),
  max_score: z.number().int().min(1).max(100),
  note: z.string().max(1000).nullable().optional(),
});
export type QaReviewScore = z.infer<typeof QaReviewScoreSchema>;

export const QaReviewSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  call_id: z.string(),
  queue_id: z.string().uuid().nullable(),
  agent_profile_id: z.string().uuid().nullable(),
  recording_id: z.string().uuid().nullable(),
  disposition_id: z.string().uuid().nullable(),
  scorecard_id: z.string().uuid(),
  reviewer_user_id: z.string().uuid().nullable(),
  status: QaReviewStatusSchema,
  scores_json: z.array(QaReviewScoreSchema),
  note_text: z.string().nullable(),
  total_score: z.number().int(),
  max_score: z.number().int(),
  completed_at: z.string().datetime().nullable(),
  acknowledged_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('QaReview');
export type QaReview = z.infer<typeof QaReviewSchema>;

export const CreateQaReviewBodySchema = z.object({
  call_id: z.string().min(1),
  queue_id: z.string().uuid().nullable().optional(),
  agent_profile_id: z.string().uuid().nullable().optional(),
  recording_id: z.string().uuid().nullable().optional(),
  disposition_id: z.string().uuid().nullable().optional(),
  scorecard_id: z.string().uuid(),
  scores_json: z.array(QaReviewScoreSchema).min(1),
  note_text: z.string().max(4000).nullable().optional(),
  status: QaReviewStatusSchema.optional(),
}).openapi('CreateQaReviewBody');
export type CreateQaReviewBody = z.infer<typeof CreateQaReviewBodySchema>;

export const UpdateQaReviewBodySchema = z.object({
  queue_id: z.string().uuid().nullable().optional(),
  agent_profile_id: z.string().uuid().nullable().optional(),
  recording_id: z.string().uuid().nullable().optional(),
  disposition_id: z.string().uuid().nullable().optional(),
  scores_json: z.array(QaReviewScoreSchema).min(1).optional(),
  note_text: z.string().max(4000).nullable().optional(),
  status: QaReviewStatusSchema.optional(),
}).openapi('UpdateQaReviewBody');
export type UpdateQaReviewBody = z.infer<typeof UpdateQaReviewBodySchema>;

export const QaSummarySchema = z.object({
  open_reviews: z.number().int(),
  completed_reviews_7d: z.number().int(),
  average_score_percent_7d: z.number().nullable(),
}).openapi('QaSummary');
export type QaSummary = z.infer<typeof QaSummarySchema>;

export const AgentAvailabilityBucketSchema = z.object({
  state: z.enum(['available', 'busy', 'away', 'wrap_up', 'offline']),
  count: z.number().int(),
}).openapi('AgentAvailabilityBucket');
export type AgentAvailabilityBucket = z.infer<typeof AgentAvailabilityBucketSchema>;

export const QueueWallboardMetricSchema = z.object({
  queue_id: z.string().uuid(),
  queue_name: z.string(),
  member_count: z.number().int(),
  available_agents: z.number().int(),
  busy_agents: z.number().int(),
  away_agents: z.number().int(),
  wrap_up_agents: z.number().int(),
  offline_agents: z.number().int(),
  offered_calls_24h: z.number().int(),
  answered_calls_24h: z.number().int(),
  abandoned_calls_24h: z.number().int(),
  active_calls: z.number().int(),
  average_wait_seconds: z.number().nullable(),
  max_wait_seconds: z.number().nullable(),
  answer_target_seconds: z.number().int(),
  answer_rate_target_percent: z.number().int(),
  abandonment_threshold_percent: z.number().int(),
  within_sla_calls_24h: z.number().int(),
  sla_percent_24h: z.number().nullable(),
  wallboard_enabled: z.boolean(),
  alert_state: z.enum(['healthy', 'warning', 'critical']),
}).openapi('QueueWallboardMetric');
export type QueueWallboardMetric = z.infer<typeof QueueWallboardMetricSchema>;

export const SupervisorSnapshotSchema = z.object({
  generated_at: z.string().datetime(),
  queue_metrics: z.array(QueueWallboardMetricSchema),
  agent_availability: z.array(AgentAvailabilityBucketSchema),
  disposition_usage_24h: z.array(DispositionUsageRowSchema),
  qa_summary: QaSummarySchema,
}).openapi('SupervisorSnapshot');
export type SupervisorSnapshot = z.infer<typeof SupervisorSnapshotSchema>;
