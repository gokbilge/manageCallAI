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
