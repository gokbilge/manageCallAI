export type WorkRequestStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type IntegrationProvider = 'auto' | 'openai' | 'elevenlabs' | 'whisper' | 'external' | 'custom';

export interface PromptGenerationRequest {
  id: string;
  tenant_id: string;
  prompt_asset_id: string | null;
  requested_outputs: string[];
  input_text: string;
  language_hint: string | null;
  voice_hint: string | null;
  provider_hint: IntegrationProvider;
  status: WorkRequestStatus;
  processor_id: string | null;
  claimed_at: string | null;
  generated_prompt_asset_id: string | null;
  media_reference: string | null;
  error_message: string | null;
  provider_metadata: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  completed_at: string | null;
}

export interface CreatePromptGenerationInput {
  prompt_asset_id?: string | null;
  requested_outputs: string[];
  input_text: string;
  language_hint?: string | null;
  voice_hint?: string | null;
  provider_hint?: IntegrationProvider;
  metadata?: Record<string, unknown>;
}

export interface CompletePromptGenerationInput {
  status: 'completed' | 'failed';
  generated_prompt_asset_id?: string | null;
  media_reference?: string | null;
  error_message?: string | null;
  provider_metadata?: Record<string, unknown>;
}

export interface IvrAiTurnRequest {
  id: string;
  tenant_id: string;
  runtime_session_id: string | null;
  call_id: string;
  flow_id: string | null;
  node_id: string;
  input_mode: 'text' | 'transcript' | 'dtmf' | 'metadata';
  input_text: string | null;
  requested_outputs: string[];
  provider_hint: IntegrationProvider;
  status: WorkRequestStatus;
  processor_id: string | null;
  claimed_at: string | null;
  answer_text: string | null;
  next_action: Record<string, unknown> | null;
  confidence: number | null;
  error_message: string | null;
  provider_metadata: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  completed_at: string | null;
}

export interface CreateIvrAiTurnInput {
  tenant_id?: string;
  runtime_session_id?: string | null;
  call_id: string;
  flow_id?: string | null;
  node_id: string;
  input_mode: 'text' | 'transcript' | 'dtmf' | 'metadata';
  input_text?: string | null;
  requested_outputs: string[];
  provider_hint?: IntegrationProvider;
  metadata?: Record<string, unknown>;
}

export interface CompleteIvrAiTurnInput {
  status: 'completed' | 'failed';
  answer_text?: string | null;
  next_action?: Record<string, unknown> | null;
  confidence?: number | null;
  error_message?: string | null;
  provider_metadata?: Record<string, unknown>;
}

export interface ClaimWorkRequestInput {
  processor_id?: string | null;
}

// ── IVR Generation (#253) ─────────────────────────────────────────────────────

export interface IvrGenerationRequest {
  id: string;
  tenant_id: string;
  flow_id: string | null;
  version_id: string | null;
  intent: string;
  flow_name: string;
  provider_hint: IntegrationProvider;
  status: WorkRequestStatus;
  processor_id: string | null;
  claimed_at: string | null;
  generated_graph: Record<string, unknown> | null;
  error_message: string | null;
  provider_metadata: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  completed_at: string | null;
}

export interface CreateIvrGenerationInput {
  flow_name: string;
  intent: string;
  provider_hint?: IntegrationProvider;
  metadata?: Record<string, unknown>;
}

export interface CompleteIvrGenerationInput {
  status: 'completed' | 'failed';
  generated_graph?: Record<string, unknown> | null;
  error_message?: string | null;
  provider_metadata?: Record<string, unknown>;
}

// ── IVR AI Patch Requests (#254) ──────────────────────────────────────────────

export type IvrAiPatchTargetType = 'ivr_flow' | 'inbound_route';
export type IvrAiPatchStatus = 'queued' | 'processing' | 'completed' | 'accepted' | 'rejected' | 'failed';

export interface IvrAiPatchRequest {
  id: string;
  tenant_id: string;
  target_type: IvrAiPatchTargetType;
  target_id: string;
  version_id: string | null;
  intent: string;
  provider_hint: IntegrationProvider;
  status: IvrAiPatchStatus;
  processor_id: string | null;
  claimed_at: string | null;
  diff_json: Record<string, unknown> | null;
  risk_level: 'low' | 'medium' | 'high' | null;
  risk_summary: string | null;
  blast_radius_hint: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  decided_by: string | null;
  error_message: string | null;
  provider_metadata: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  completed_at: string | null;
}

export interface CreateIvrAiPatchInput {
  target_type: IvrAiPatchTargetType;
  target_id: string;
  version_id?: string | null;
  intent: string;
  provider_hint?: IntegrationProvider;
  metadata?: Record<string, unknown>;
}

export interface CompleteIvrAiPatchInput {
  status: 'completed' | 'failed';
  diff_json?: Record<string, unknown> | null;
  risk_level?: 'low' | 'medium' | 'high' | null;
  risk_summary?: string | null;
  blast_radius_hint?: string | null;
  error_message?: string | null;
  provider_metadata?: Record<string, unknown>;
}
