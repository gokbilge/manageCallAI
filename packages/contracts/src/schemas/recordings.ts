import { z } from '../registry.js';
import { IntegrationProviderSchema } from './provider-work.js';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const RecordingStatusSchema = z.enum(['pending', 'available', 'deleted']);
export type RecordingStatus = z.infer<typeof RecordingStatusSchema>;

export const RecordingAnalysisStatusSchema = z.enum([
  'queued',
  'processing',
  'completed',
  'failed',
  'cancelled',
]);
export type RecordingAnalysisStatus = z.infer<typeof RecordingAnalysisStatusSchema>;

export const RecordingAnalysisOutputSchema = z.enum(['transcript', 'summary']);
export type RecordingAnalysisOutput = z.infer<typeof RecordingAnalysisOutputSchema>;
export const RecordingAnalysisSourceModeSchema = z.enum(['deterministic', 'provider_backed']);
export type RecordingAnalysisSourceMode = z.infer<typeof RecordingAnalysisSourceModeSchema>;

// ── Resource schemas ──────────────────────────────────────────────────────────
export const RecordingSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  call_id: z.string(),
  call_event_id: z.string().uuid().nullable(),
  storage_path: z.string(),
  duration_secs: z.number().int().nullable(),
  size_bytes: z.number().int().nullable(),
  status: RecordingStatusSchema,
  recorded_at: z.string().datetime(),
  created_at: z.string().datetime(),
}).openapi('Recording');
export type Recording = z.infer<typeof RecordingSchema>;

export const RecordingAnalysisRequestSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  recording_id: z.string().uuid(),
  requested_outputs: z.array(RecordingAnalysisOutputSchema),
  language_hint: z.string().nullable(),
  provider_hint: IntegrationProviderSchema,
  status: RecordingAnalysisStatusSchema,
  transcript_status: RecordingAnalysisStatusSchema.nullable(),
  summary_status: RecordingAnalysisStatusSchema.nullable(),
  processor_id: z.string().nullable(),
  claimed_at: z.string().datetime().nullable(),
  language: z.string().nullable(),
  transcript_text: z.string().nullable(),
  summary_text: z.string().nullable(),
  error_message: z.string().nullable(),
  provider_metadata: z.record(z.unknown()),
  metadata: z.record(z.unknown()),
  source_mode: RecordingAnalysisSourceModeSchema,
  created_at: z.string().datetime(),
  completed_at: z.string().datetime().nullable(),
}).openapi('RecordingAnalysisRequest');
export type RecordingAnalysisRequest = z.infer<typeof RecordingAnalysisRequestSchema>;

export const SummaryReviewStatusSchema = z.enum([
  'missing_analysis',
  'queued',
  'processing',
  'completed',
  'failed',
  'cancelled',
  'unavailable',
]);
export type SummaryReviewStatus = z.infer<typeof SummaryReviewStatusSchema>;

export const SummaryReviewReasonSchema = z.enum([
  'no_linked_recording',
  'no_analysis_request',
  'summary_missing',
  'summary_retention_elapsed',
  'transcript_retention_elapsed',
  'analysis_failed',
  'analysis_cancelled',
]);
export type SummaryReviewReason = z.infer<typeof SummaryReviewReasonSchema>;

export const SummaryReviewSchema = z.object({
  resource_type: z.enum(['call', 'recording', 'voicemail']),
  resource_id: z.string(),
  call_id: z.string(),
  linked_recording_id: z.string().uuid().nullable(),
  analysis_request_id: z.string().uuid().nullable(),
  status: SummaryReviewStatusSchema,
  transcript_status: RecordingAnalysisStatusSchema.nullable(),
  summary_status: RecordingAnalysisStatusSchema.nullable(),
  source_mode: RecordingAnalysisSourceModeSchema,
  provider_hint: IntegrationProviderSchema,
  reason: SummaryReviewReasonSchema.nullable(),
  summary_text: z.string().nullable(),
  transcript_text: z.string().nullable(),
  transcript_access: z.enum(['granted', 'restricted', 'unavailable']),
  can_view_transcript: z.boolean(),
  language: z.string().nullable(),
  requested_outputs: z.array(RecordingAnalysisOutputSchema),
  completed_at: z.string().datetime().nullable(),
  provider_metadata: z.record(z.unknown()),
}).openapi('SummaryReview');
export type SummaryReview = z.infer<typeof SummaryReviewSchema>;

// ── Request schemas ───────────────────────────────────────────────────────────
export const IngestRecordingBodySchema = z.object({
  call_id: z.string().min(1),
  call_event_id: z.string().uuid().nullable().optional(),
  storage_path: z.string().min(1),
  duration_secs: z.number().int().nullable().optional(),
  size_bytes: z.number().int().nullable().optional(),
  recorded_at: z.string().datetime().optional(),
}).openapi('IngestRecordingBody');
export type IngestRecordingBody = z.infer<typeof IngestRecordingBodySchema>;

export const CreateRecordingAnalysisBodySchema = z.object({
  requested_outputs: z.array(RecordingAnalysisOutputSchema).min(1),
  language_hint: z.string().nullable().optional(),
  provider_hint: IntegrationProviderSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
}).openapi('CreateRecordingAnalysisBody');
export type CreateRecordingAnalysisBody = z.infer<typeof CreateRecordingAnalysisBodySchema>;

export const CompleteRecordingAnalysisBodySchema = z.object({
  status: z.enum(['completed', 'failed']),
  language: z.string().nullable().optional(),
  transcript_text: z.string().nullable().optional(),
  summary_text: z.string().nullable().optional(),
  error_message: z.string().nullable().optional(),
  provider_metadata: z.record(z.unknown()).optional(),
}).openapi('CompleteRecordingAnalysisBody');
export type CompleteRecordingAnalysisBody = z.infer<typeof CompleteRecordingAnalysisBodySchema>;
