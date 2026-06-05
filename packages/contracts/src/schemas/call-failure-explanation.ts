import { z } from '../registry.js';

export const ExplanationStatusSchema = z.enum(['explained', 'unavailable']);
export type ExplanationStatus = z.infer<typeof ExplanationStatusSchema>;

export const UnavailableReasonSchema = z.enum(['no_events', 'not_failed']);
export type UnavailableReason = z.infer<typeof UnavailableReasonSchema>;

export const FailureFactSchema = z.object({
  code: z.string(),
  observed: z.string(),
}).openapi('FailureFact');
export type FailureFact = z.infer<typeof FailureFactSchema>;

export const ExplainEventSummarySchema = z.object({
  event_type: z.string(),
  event_time: z.string().datetime(),
  source: z.string().nullable(),
}).openapi('ExplainEventSummary');
export type ExplainEventSummary = z.infer<typeof ExplainEventSummarySchema>;

export const CallFailureExplanationSchema = z.object({
  call_id: z.string(),
  status: ExplanationStatusSchema,
  unavailable_reason: UnavailableReasonSchema.optional(),
  observed_facts: z.array(FailureFactSchema),
  likely_cause: z.string(),
  next_action: z.string(),
  event_timeline: z.array(ExplainEventSummarySchema),
  is_advisory: z.literal(true),
  explained_at: z.string().datetime(),
}).openapi('CallFailureExplanation');
export type CallFailureExplanation = z.infer<typeof CallFailureExplanationSchema>;

export const CallFailureExplainRequestSchema = z.object({
  call_id: z.string().min(1).max(256),
}).openapi('CallFailureExplainRequest');
export type CallFailureExplainRequest = z.infer<typeof CallFailureExplainRequestSchema>;
