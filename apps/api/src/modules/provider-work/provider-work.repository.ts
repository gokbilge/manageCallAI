import type { Pool } from 'pg';
import type {
  ClaimWorkRequestInput,
  CompleteIvrAiTurnInput,
  CompletePromptGenerationInput,
  CreateIvrAiTurnInput,
  CreatePromptGenerationInput,
  IvrAiTurnRequest,
  PromptGenerationRequest,
} from './provider-work.types.js';

const promptColumns = `id, tenant_id, prompt_asset_id, requested_outputs, input_text, language_hint,
  voice_hint, provider_hint, status, processor_id, claimed_at, generated_prompt_asset_id,
  media_reference, error_message, provider_metadata, metadata, created_at, completed_at`;

const ivrAiColumns = `id, tenant_id, runtime_session_id, call_id, flow_id, node_id, input_mode,
  input_text, requested_outputs, provider_hint, status, processor_id, claimed_at, answer_text,
  next_action, confidence, error_message, provider_metadata, metadata, created_at, completed_at`;

export class ProviderWorkRepository {
  constructor(private readonly db: Pool) {}

  async createPromptGeneration(tenantId: string, input: CreatePromptGenerationInput): Promise<PromptGenerationRequest> {
    const result = await this.db.query<PromptGenerationRequest>(
      `INSERT INTO prompt_generation_requests
         (tenant_id, prompt_asset_id, requested_outputs, input_text, language_hint, voice_hint, provider_hint, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       RETURNING ${promptColumns}`,
      [
        tenantId,
        input.prompt_asset_id ?? null,
        input.requested_outputs,
        input.input_text,
        input.language_hint ?? null,
        input.voice_hint ?? null,
        input.provider_hint ?? 'auto',
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return result.rows[0]!;
  }

  async listPromptGenerations(tenantId: string): Promise<PromptGenerationRequest[]> {
    const result = await this.db.query<PromptGenerationRequest>(
      `SELECT ${promptColumns}
       FROM prompt_generation_requests
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT 200`,
      [tenantId],
    );
    return result.rows;
  }

  async findPromptGeneration(id: string, tenantId: string): Promise<PromptGenerationRequest | null> {
    const result = await this.db.query<PromptGenerationRequest>(
      `SELECT ${promptColumns}
       FROM prompt_generation_requests
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async claimPromptGeneration(id: string, input: ClaimWorkRequestInput): Promise<PromptGenerationRequest | null> {
    const result = await this.db.query<PromptGenerationRequest>(
      `UPDATE prompt_generation_requests
       SET status = 'processing', processor_id = $2, claimed_at = NOW()
       WHERE id = $1 AND status = 'queued'
       RETURNING ${promptColumns}`,
      [id, input.processor_id ?? null],
    );
    return result.rows[0] ?? null;
  }

  async completePromptGeneration(id: string, input: CompletePromptGenerationInput): Promise<PromptGenerationRequest | null> {
    const result = await this.db.query<PromptGenerationRequest>(
      `UPDATE prompt_generation_requests
       SET status = $2,
           generated_prompt_asset_id = $3,
           media_reference = $4,
           error_message = LEFT($5, 500),
           provider_metadata = $6::jsonb,
           completed_at = NOW()
       WHERE id = $1 AND status IN ('queued', 'processing')
       RETURNING ${promptColumns}`,
      [
        id,
        input.status,
        input.generated_prompt_asset_id ?? null,
        input.media_reference ?? null,
        input.error_message ?? null,
        JSON.stringify(input.provider_metadata ?? {}),
      ],
    );
    return result.rows[0] ?? null;
  }

  async createIvrAiTurn(tenantId: string, input: CreateIvrAiTurnInput): Promise<IvrAiTurnRequest> {
    const result = await this.db.query<IvrAiTurnRequest>(
      `INSERT INTO ivr_ai_turn_requests
         (tenant_id, runtime_session_id, call_id, flow_id, node_id, input_mode, input_text,
          requested_outputs, provider_hint, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
       RETURNING ${ivrAiColumns}`,
      [
        tenantId,
        input.runtime_session_id ?? null,
        input.call_id,
        input.flow_id ?? null,
        input.node_id,
        input.input_mode,
        input.input_text ?? null,
        input.requested_outputs,
        input.provider_hint ?? 'auto',
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return result.rows[0]!;
  }

  async findIvrAiTurn(id: string, tenantId: string): Promise<IvrAiTurnRequest | null> {
    const result = await this.db.query<IvrAiTurnRequest>(
      `SELECT ${ivrAiColumns}
       FROM ivr_ai_turn_requests
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async claimIvrAiTurn(id: string, input: ClaimWorkRequestInput): Promise<IvrAiTurnRequest | null> {
    const result = await this.db.query<IvrAiTurnRequest>(
      `UPDATE ivr_ai_turn_requests
       SET status = 'processing', processor_id = $2, claimed_at = NOW()
       WHERE id = $1 AND status = 'queued'
       RETURNING ${ivrAiColumns}`,
      [id, input.processor_id ?? null],
    );
    return result.rows[0] ?? null;
  }

  async completeIvrAiTurn(id: string, input: CompleteIvrAiTurnInput): Promise<IvrAiTurnRequest | null> {
    const result = await this.db.query<IvrAiTurnRequest>(
      `UPDATE ivr_ai_turn_requests
       SET status = $2,
           answer_text = $3,
           next_action = $4::jsonb,
           confidence = $5,
           error_message = LEFT($6, 500),
           provider_metadata = $7::jsonb,
           completed_at = NOW()
       WHERE id = $1 AND status IN ('queued', 'processing')
       RETURNING ${ivrAiColumns}`,
      [
        id,
        input.status,
        input.answer_text ?? null,
        input.next_action ? JSON.stringify(input.next_action) : null,
        input.confidence ?? null,
        input.error_message ?? null,
        JSON.stringify(input.provider_metadata ?? {}),
      ],
    );
    return result.rows[0] ?? null;
  }
}
