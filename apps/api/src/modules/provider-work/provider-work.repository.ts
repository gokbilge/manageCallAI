import type { Pool } from 'pg';
import type {
  ClaimWorkRequestInput,
  CompleteIvrAiTurnInput,
  CompleteIvrAiPatchInput,
  CompleteIvrGenerationInput,
  CompletePromptGenerationInput,
  CreateIvrAiTurnInput,
  CreateIvrAiPatchInput,
  CreateIvrGenerationInput,
  CreatePromptGenerationInput,
  IvrAiPatchRequest,
  IvrAiTurnRequest,
  IvrGenerationRequest,
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

  // ── IVR Generation (#253) ───────────────────────────────────────────────────

  private static readonly genColumns = `id, tenant_id, flow_id, version_id, intent, flow_name,
    provider_hint, status, processor_id, claimed_at, generated_graph, error_message,
    provider_metadata, metadata, created_at, completed_at`;

  async createIvrGeneration(tenantId: string, input: CreateIvrGenerationInput): Promise<IvrGenerationRequest> {
    const result = await this.db.query<IvrGenerationRequest>(
      `INSERT INTO ivr_generation_requests
         (tenant_id, intent, flow_name, provider_hint, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       RETURNING ${ProviderWorkRepository.genColumns}`,
      [
        tenantId,
        input.intent,
        input.flow_name,
        input.provider_hint ?? 'auto',
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return result.rows[0]!;
  }

  async linkIvrGenerationToFlow(id: string, flowId: string, versionId: string): Promise<void> {
    await this.db.query(
      `UPDATE ivr_generation_requests SET flow_id = $2, version_id = $3 WHERE id = $1`,
      [id, flowId, versionId],
    );
  }

  async listIvrGenerations(tenantId: string): Promise<IvrGenerationRequest[]> {
    const result = await this.db.query<IvrGenerationRequest>(
      `SELECT ${ProviderWorkRepository.genColumns}
       FROM ivr_generation_requests
       WHERE tenant_id = $1
       ORDER BY created_at DESC
       LIMIT 200`,
      [tenantId],
    );
    return result.rows;
  }

  async findIvrGeneration(id: string, tenantId: string): Promise<IvrGenerationRequest | null> {
    const result = await this.db.query<IvrGenerationRequest>(
      `SELECT ${ProviderWorkRepository.genColumns}
       FROM ivr_generation_requests
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async claimIvrGeneration(id: string, input: ClaimWorkRequestInput): Promise<IvrGenerationRequest | null> {
    const result = await this.db.query<IvrGenerationRequest>(
      `UPDATE ivr_generation_requests
       SET status = 'processing', processor_id = $2, claimed_at = NOW()
       WHERE id = $1 AND status = 'queued'
       RETURNING ${ProviderWorkRepository.genColumns}`,
      [id, input.processor_id ?? null],
    );
    return result.rows[0] ?? null;
  }

  async completeIvrGeneration(id: string, input: CompleteIvrGenerationInput): Promise<IvrGenerationRequest | null> {
    const result = await this.db.query<IvrGenerationRequest>(
      `UPDATE ivr_generation_requests
       SET status = $2,
           generated_graph = $3::jsonb,
           error_message = LEFT($4, 500),
           provider_metadata = $5::jsonb,
           completed_at = NOW()
       WHERE id = $1 AND status IN ('queued', 'processing')
       RETURNING ${ProviderWorkRepository.genColumns}`,
      [
        id,
        input.status,
        input.generated_graph ? JSON.stringify(input.generated_graph) : null,
        input.error_message ?? null,
        JSON.stringify(input.provider_metadata ?? {}),
      ],
    );
    return result.rows[0] ?? null;
  }

  // ── IVR AI Patch Requests (#254) ─────────────────────────────────────────────

  private static readonly patchColumns = `id, tenant_id, target_type, target_id, version_id, intent,
    provider_hint, status, processor_id, claimed_at, diff_json, risk_level, risk_summary,
    blast_radius_hint, accepted_at, rejected_at, decided_by, error_message,
    provider_metadata, metadata, created_at, completed_at`;

  async createIvrAiPatch(tenantId: string, input: CreateIvrAiPatchInput): Promise<IvrAiPatchRequest> {
    const result = await this.db.query<IvrAiPatchRequest>(
      `INSERT INTO ivr_ai_patch_requests
         (tenant_id, target_type, target_id, version_id, intent, provider_hint, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       RETURNING ${ProviderWorkRepository.patchColumns}`,
      [
        tenantId,
        input.target_type,
        input.target_id,
        input.version_id ?? null,
        input.intent,
        input.provider_hint ?? 'auto',
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    return result.rows[0]!;
  }

  async listIvrAiPatches(tenantId: string, targetType: string, targetId: string): Promise<IvrAiPatchRequest[]> {
    const result = await this.db.query<IvrAiPatchRequest>(
      `SELECT ${ProviderWorkRepository.patchColumns}
       FROM ivr_ai_patch_requests
       WHERE tenant_id = $1 AND target_type = $2 AND target_id = $3
       ORDER BY created_at DESC
       LIMIT 100`,
      [tenantId, targetType, targetId],
    );
    return result.rows;
  }

  async findIvrAiPatch(id: string, tenantId: string): Promise<IvrAiPatchRequest | null> {
    const result = await this.db.query<IvrAiPatchRequest>(
      `SELECT ${ProviderWorkRepository.patchColumns}
       FROM ivr_ai_patch_requests
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async claimIvrAiPatch(id: string, input: ClaimWorkRequestInput): Promise<IvrAiPatchRequest | null> {
    const result = await this.db.query<IvrAiPatchRequest>(
      `UPDATE ivr_ai_patch_requests
       SET status = 'processing', processor_id = $2, claimed_at = NOW()
       WHERE id = $1 AND status = 'queued'
       RETURNING ${ProviderWorkRepository.patchColumns}`,
      [id, input.processor_id ?? null],
    );
    return result.rows[0] ?? null;
  }

  async completeIvrAiPatch(id: string, input: CompleteIvrAiPatchInput): Promise<IvrAiPatchRequest | null> {
    const result = await this.db.query<IvrAiPatchRequest>(
      `UPDATE ivr_ai_patch_requests
       SET status = $2,
           diff_json = $3::jsonb,
           risk_level = $4,
           risk_summary = $5,
           blast_radius_hint = $6,
           error_message = LEFT($7, 500),
           provider_metadata = $8::jsonb,
           completed_at = NOW()
       WHERE id = $1 AND status IN ('queued', 'processing')
       RETURNING ${ProviderWorkRepository.patchColumns}`,
      [
        id,
        input.status,
        input.diff_json ? JSON.stringify(input.diff_json) : null,
        input.risk_level ?? null,
        input.risk_summary ?? null,
        input.blast_radius_hint ?? null,
        input.error_message ?? null,
        JSON.stringify(input.provider_metadata ?? {}),
      ],
    );
    return result.rows[0] ?? null;
  }

  async acceptIvrAiPatch(id: string, decidedBy: string): Promise<IvrAiPatchRequest | null> {
    const result = await this.db.query<IvrAiPatchRequest>(
      `UPDATE ivr_ai_patch_requests
       SET status = 'accepted', accepted_at = NOW(), decided_by = $2
       WHERE id = $1 AND status = 'completed'
       RETURNING ${ProviderWorkRepository.patchColumns}`,
      [id, decidedBy],
    );
    return result.rows[0] ?? null;
  }

  async rejectIvrAiPatch(id: string, decidedBy: string): Promise<IvrAiPatchRequest | null> {
    const result = await this.db.query<IvrAiPatchRequest>(
      `UPDATE ivr_ai_patch_requests
       SET status = 'rejected', rejected_at = NOW(), decided_by = $2
       WHERE id = $1 AND status = 'completed'
       RETURNING ${ProviderWorkRepository.patchColumns}`,
      [id, decidedBy],
    );
    return result.rows[0] ?? null;
  }
}
