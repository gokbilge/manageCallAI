import { z } from '../registry.js';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const WorkRequestStatusSchema = z.enum([
  'queued',
  'processing',
  'completed',
  'failed',
  'cancelled',
]);
export type WorkRequestStatus = z.infer<typeof WorkRequestStatusSchema>;

export const IntegrationProviderSchema = z.enum([
  'auto',
  'openai',
  'elevenlabs',
  'whisper',
  'external',
  'custom',
]);
export type IntegrationProvider = z.infer<typeof IntegrationProviderSchema>;

export const AiRiskLevelSchema = z.enum(['low', 'medium', 'high']);
export type AiRiskLevel = z.infer<typeof AiRiskLevelSchema>;

export const AiAssistedContextSchema = z.object({
  source_request_type: z.enum(['prompt_generation', 'ivr_ai_turn', 'ivr_generation', 'ivr_ai_patch']).optional(),
  source_request_id: z.string().uuid().optional(),
  prompt_template_id: z.string().min(1).max(255).optional(),
  prompt_summary: z.string().min(1).max(1000).optional(),
  normalized_input: z.string().min(1).max(2000).optional(),
  output_summary: z.string().min(1).max(2000).optional(),
  provider: IntegrationProviderSchema.optional(),
  model: z.string().min(1).max(255).optional(),
  risk_level: AiRiskLevelSchema.optional(),
  risk_summary: z.string().min(1).max(1000).optional(),
}).openapi('AiAssistedContext');
export type AiAssistedContext = z.infer<typeof AiAssistedContextSchema>;

// ── Resource schemas ──────────────────────────────────────────────────────────
export const PromptGenerationRequestSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  prompt_asset_id: z.string().uuid().nullable(),
  requested_outputs: z.array(z.string()),
  input_text: z.string(),
  language_hint: z.string().nullable(),
  voice_hint: z.string().nullable(),
  provider_hint: IntegrationProviderSchema,
  status: WorkRequestStatusSchema,
  processor_id: z.string().nullable(),
  claimed_at: z.string().datetime().nullable(),
  generated_prompt_asset_id: z.string().uuid().nullable(),
  media_reference: z.string().nullable(),
  error_message: z.string().nullable(),
  provider_metadata: z.record(z.unknown()),
  metadata: z.record(z.unknown()),
  created_at: z.string().datetime(),
  completed_at: z.string().datetime().nullable(),
}).openapi('PromptGenerationRequest');
export type PromptGenerationRequest = z.infer<typeof PromptGenerationRequestSchema>;

export const IvrAiTurnRequestSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  runtime_session_id: z.string().uuid().nullable(),
  call_id: z.string(),
  flow_id: z.string().uuid().nullable(),
  node_id: z.string(),
  input_mode: z.enum(['text', 'transcript', 'dtmf', 'metadata']),
  input_text: z.string().nullable(),
  requested_outputs: z.array(z.string()),
  provider_hint: IntegrationProviderSchema,
  status: WorkRequestStatusSchema,
  processor_id: z.string().nullable(),
  claimed_at: z.string().datetime().nullable(),
  answer_text: z.string().nullable(),
  next_action: z.record(z.unknown()).nullable(),
  confidence: z.number().nullable(),
  error_message: z.string().nullable(),
  provider_metadata: z.record(z.unknown()),
  metadata: z.record(z.unknown()),
  created_at: z.string().datetime(),
  completed_at: z.string().datetime().nullable(),
}).openapi('IvrAiTurnRequest');
export type IvrAiTurnRequest = z.infer<typeof IvrAiTurnRequestSchema>;

// ── Request schemas ───────────────────────────────────────────────────────────
export const CreatePromptGenerationBodySchema = z.object({
  prompt_asset_id: z.string().uuid().nullable().optional(),
  requested_outputs: z.array(z.string()).min(1),
  input_text: z.string().min(1),
  language_hint: z.string().nullable().optional(),
  voice_hint: z.string().nullable().optional(),
  provider_hint: IntegrationProviderSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
}).openapi('CreatePromptGenerationBody');
export type CreatePromptGenerationBody = z.infer<typeof CreatePromptGenerationBodySchema>;

export const CompletePromptGenerationBodySchema = z.object({
  status: z.enum(['completed', 'failed']),
  generated_prompt_asset_id: z.string().uuid().nullable().optional(),
  media_reference: z.string().nullable().optional(),
  error_message: z.string().nullable().optional(),
  provider_metadata: z.record(z.unknown()).optional(),
}).openapi('CompletePromptGenerationBody');
export type CompletePromptGenerationBody = z.infer<typeof CompletePromptGenerationBodySchema>;

export const CreateIvrAiTurnBodySchema = z.object({
  runtime_session_id: z.string().uuid().nullable().optional(),
  call_id: z.string().min(1),
  flow_id: z.string().uuid().nullable().optional(),
  node_id: z.string().min(1),
  input_mode: z.enum(['text', 'transcript', 'dtmf', 'metadata']),
  input_text: z.string().nullable().optional(),
  requested_outputs: z.array(z.string()).min(1),
  provider_hint: IntegrationProviderSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
}).openapi('CreateIvrAiTurnBody');
export type CreateIvrAiTurnBody = z.infer<typeof CreateIvrAiTurnBodySchema>;

export const CompleteIvrAiTurnBodySchema = z.object({
  status: z.enum(['completed', 'failed']),
  answer_text: z.string().nullable().optional(),
  next_action: z.record(z.unknown()).nullable().optional(),
  confidence: z.number().nullable().optional(),
  error_message: z.string().nullable().optional(),
  provider_metadata: z.record(z.unknown()).optional(),
}).openapi('CompleteIvrAiTurnBody');
export type CompleteIvrAiTurnBody = z.infer<typeof CompleteIvrAiTurnBodySchema>;

export const ClaimWorkRequestBodySchema = z.object({
  processor_id: z.string().nullable().optional(),
}).openapi('ClaimWorkRequestBody');
export type ClaimWorkRequestBody = z.infer<typeof ClaimWorkRequestBodySchema>;

// ── IVR Generation Requests (#253) ────────────────────────────────────────────

export const IvrGenerationRequestSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  flow_id: z.string().uuid().nullable(),
  version_id: z.string().uuid().nullable(),
  intent: z.string(),
  flow_name: z.string(),
  provider_hint: IntegrationProviderSchema,
  status: WorkRequestStatusSchema,
  processor_id: z.string().nullable(),
  claimed_at: z.string().datetime().nullable(),
  generated_graph: z.record(z.unknown()).nullable(),
  error_message: z.string().nullable(),
  provider_metadata: z.record(z.unknown()),
  metadata: z.record(z.unknown()),
  created_at: z.string().datetime(),
  completed_at: z.string().datetime().nullable(),
}).openapi('IvrGenerationRequest');
export type IvrGenerationRequest = z.infer<typeof IvrGenerationRequestSchema>;

export const CreateIvrGenerationBodySchema = z.object({
  flow_name: z.string().min(1).max(255),
  intent: z.string().min(1).max(4000),
  provider_hint: IntegrationProviderSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
}).openapi('CreateIvrGenerationBody');
export type CreateIvrGenerationBody = z.infer<typeof CreateIvrGenerationBodySchema>;

export const CompleteIvrGenerationBodySchema = z.object({
  status: z.enum(['completed', 'failed']),
  generated_graph: z.record(z.unknown()).nullable().optional(),
  error_message: z.string().nullable().optional(),
  provider_metadata: z.record(z.unknown()).optional(),
}).openapi('CompleteIvrGenerationBody');
export type CompleteIvrGenerationBody = z.infer<typeof CompleteIvrGenerationBodySchema>;

// ── IVR AI Patch Requests (#254) ──────────────────────────────────────────────

export const IvrAiPatchTargetTypeSchema = z.enum(['ivr_flow', 'inbound_route']);
export type IvrAiPatchTargetType = z.infer<typeof IvrAiPatchTargetTypeSchema>;

export const IvrAiPatchStatusSchema = z.enum([
  'queued', 'processing', 'completed', 'accepted', 'rejected', 'failed',
]);
export type IvrAiPatchStatus = z.infer<typeof IvrAiPatchStatusSchema>;

export const IvrAiPatchRequestSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  target_type: IvrAiPatchTargetTypeSchema,
  target_id: z.string().uuid(),
  version_id: z.string().uuid().nullable(),
  intent: z.string(),
  provider_hint: IntegrationProviderSchema,
  status: IvrAiPatchStatusSchema,
  processor_id: z.string().nullable(),
  claimed_at: z.string().datetime().nullable(),
  diff_json: z.record(z.unknown()).nullable(),
  risk_level: AiRiskLevelSchema.nullable(),
  risk_summary: z.string().nullable(),
  blast_radius_hint: z.string().nullable(),
  accepted_at: z.string().datetime().nullable(),
  rejected_at: z.string().datetime().nullable(),
  decided_by: z.string().uuid().nullable(),
  error_message: z.string().nullable(),
  provider_metadata: z.record(z.unknown()),
  metadata: z.record(z.unknown()),
  created_at: z.string().datetime(),
  completed_at: z.string().datetime().nullable(),
}).openapi('IvrAiPatchRequest');
export type IvrAiPatchRequest = z.infer<typeof IvrAiPatchRequestSchema>;

export const CreateIvrAiPatchBodySchema = z.object({
  intent: z.string().min(1).max(4000),
  provider_hint: IntegrationProviderSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
}).openapi('CreateIvrAiPatchBody');
export type CreateIvrAiPatchBody = z.infer<typeof CreateIvrAiPatchBodySchema>;

export const CompleteIvrAiPatchBodySchema = z.object({
  status: z.enum(['completed', 'failed']),
  diff_json: z.record(z.unknown()).nullable().optional(),
  risk_level: AiRiskLevelSchema.nullable().optional(),
  risk_summary: z.string().nullable().optional(),
  blast_radius_hint: z.string().nullable().optional(),
  error_message: z.string().nullable().optional(),
  provider_metadata: z.record(z.unknown()).optional(),
}).openapi('CompleteIvrAiPatchBody');
export type CompleteIvrAiPatchBody = z.infer<typeof CompleteIvrAiPatchBodySchema>;
