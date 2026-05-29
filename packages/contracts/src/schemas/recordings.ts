import { z } from '../registry.js';

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
  status: RecordingAnalysisStatusSchema,
  processor_id: z.string().nullable(),
  claimed_at: z.string().datetime().nullable(),
  language: z.string().nullable(),
  transcript_text: z.string().nullable(),
  summary_text: z.string().nullable(),
  error_message: z.string().nullable(),
  provider_metadata: z.record(z.unknown()),
  metadata: z.record(z.unknown()),
  created_at: z.string().datetime(),
  completed_at: z.string().datetime().nullable(),
}).openapi('RecordingAnalysisRequest');
export type RecordingAnalysisRequest = z.infer<typeof RecordingAnalysisRequestSchema>;

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
