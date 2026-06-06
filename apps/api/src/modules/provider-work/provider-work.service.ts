import type { ProviderWorkRepository } from './provider-work.repository.js';
import type {
  ClaimWorkRequestInput,
  CompleteIvrAiPatchInput,
  CompleteIvrAiTurnInput,
  CompleteIvrGenerationInput,
  CompletePromptGenerationInput,
  CreateIvrAiPatchInput,
  CreateIvrAiTurnInput,
  CreateIvrGenerationInput,
  CreatePromptGenerationInput,
  IntegrationProvider,
  IvrAiPatchRequest,
  IvrAiTurnRequest,
  IvrGenerationRequest,
  PromptGenerationRequest,
} from './provider-work.types.js';
import type { AiPolicyService } from '../ai-policy/ai-policy.service.js';

export class ProviderWorkRequestNotFoundError extends Error {
  constructor(id: string) {
    super(`Provider work request not found or not claimable: ${id}`);
    this.name = 'ProviderWorkRequestNotFoundError';
  }
}

export class ProviderWorkService {
  constructor(
    private readonly repo: ProviderWorkRepository,
    private readonly aiPolicyService?: AiPolicyService,
  ) {}

  async createPromptGeneration(tenantId: string, input: CreatePromptGenerationInput): Promise<PromptGenerationRequest> {
    this.validateOutputs(input.requested_outputs);
    const resolved = await this.resolveProvider('prompt_generation', tenantId, input.provider_hint, input.input_text, false);
    return this.repo.createPromptGeneration(tenantId, {
      ...input,
      provider_hint: resolved.effective_provider_hint,
      metadata: {
        ...(input.metadata ?? {}),
        ai_policy: {
          requested_provider_hint: resolved.requested_provider_hint,
          effective_provider_hint: resolved.effective_provider_hint,
          provider_backed_requested: resolved.provider_backed_requested,
          provider_backed_allowed: resolved.provider_backed_allowed,
          fallback_reason: resolved.fallback_reason,
        },
      },
    });
  }

  listPromptGenerations(tenantId: string): Promise<PromptGenerationRequest[]> {
    return this.repo.listPromptGenerations(tenantId);
  }

  async getPromptGeneration(id: string, tenantId: string): Promise<PromptGenerationRequest> {
    const request = await this.repo.findPromptGeneration(id, tenantId);
    if (!request) throw new ProviderWorkRequestNotFoundError(id);
    return request;
  }

  async claimPromptGeneration(id: string, input: ClaimWorkRequestInput): Promise<PromptGenerationRequest> {
    const request = await this.repo.claimPromptGeneration(id, input);
    if (!request) throw new ProviderWorkRequestNotFoundError(id);
    return request;
  }

  async completePromptGeneration(id: string, input: CompletePromptGenerationInput): Promise<PromptGenerationRequest> {
    const request = await this.repo.completePromptGeneration(id, input);
    if (!request) throw new ProviderWorkRequestNotFoundError(id);
    return request;
  }

  async createIvrAiTurn(tenantId: string, input: CreateIvrAiTurnInput): Promise<IvrAiTurnRequest> {
    this.validateOutputs(input.requested_outputs);
    const resolved = await this.resolveProvider('ivr_ai_turn', tenantId, input.provider_hint, input.input_text, true);
    return this.repo.createIvrAiTurn(tenantId, {
      ...input,
      provider_hint: resolved.effective_provider_hint,
      metadata: {
        ...(input.metadata ?? {}),
        ai_policy: {
          requested_provider_hint: resolved.requested_provider_hint,
          effective_provider_hint: resolved.effective_provider_hint,
          provider_backed_requested: resolved.provider_backed_requested,
          provider_backed_allowed: resolved.provider_backed_allowed,
          fallback_reason: resolved.fallback_reason,
        },
      },
    });
  }

  async getIvrAiTurn(id: string, tenantId: string): Promise<IvrAiTurnRequest> {
    const request = await this.repo.findIvrAiTurn(id, tenantId);
    if (!request) throw new ProviderWorkRequestNotFoundError(id);
    return request;
  }

  async claimIvrAiTurn(id: string, input: ClaimWorkRequestInput): Promise<IvrAiTurnRequest> {
    const request = await this.repo.claimIvrAiTurn(id, input);
    if (!request) throw new ProviderWorkRequestNotFoundError(id);
    return request;
  }

  async completeIvrAiTurn(id: string, input: CompleteIvrAiTurnInput): Promise<IvrAiTurnRequest> {
    const request = await this.repo.completeIvrAiTurn(id, input);
    if (!request) throw new ProviderWorkRequestNotFoundError(id);
    return request;
  }

  // ── IVR Generation (#253) ───────────────────────────────────────────────────

  async createIvrGeneration(tenantId: string, input: CreateIvrGenerationInput): Promise<IvrGenerationRequest> {
    const resolved = await this.resolveProvider('ivr_generation', tenantId, input.provider_hint, input.intent, false);
    return this.repo.createIvrGeneration(tenantId, {
      ...input,
      provider_hint: resolved.effective_provider_hint,
      metadata: {
        ...(input.metadata ?? {}),
        ai_policy: {
          requested_provider_hint: resolved.requested_provider_hint,
          effective_provider_hint: resolved.effective_provider_hint,
          provider_backed_requested: resolved.provider_backed_requested,
          provider_backed_allowed: resolved.provider_backed_allowed,
          fallback_reason: resolved.fallback_reason,
        },
      },
    });
  }

  listIvrGenerations(tenantId: string): Promise<IvrGenerationRequest[]> {
    return this.repo.listIvrGenerations(tenantId);
  }

  async getIvrGeneration(id: string, tenantId: string): Promise<IvrGenerationRequest> {
    const request = await this.repo.findIvrGeneration(id, tenantId);
    if (!request) throw new ProviderWorkRequestNotFoundError(id);
    return request;
  }

  async linkIvrGenerationToFlow(id: string, flowId: string, versionId: string): Promise<void> {
    return this.repo.linkIvrGenerationToFlow(id, flowId, versionId);
  }

  async claimIvrGeneration(id: string, input: ClaimWorkRequestInput): Promise<IvrGenerationRequest> {
    const request = await this.repo.claimIvrGeneration(id, input);
    if (!request) throw new ProviderWorkRequestNotFoundError(id);
    return request;
  }

  async completeIvrGeneration(id: string, input: CompleteIvrGenerationInput): Promise<IvrGenerationRequest> {
    const request = await this.repo.completeIvrGeneration(id, input);
    if (!request) throw new ProviderWorkRequestNotFoundError(id);
    return request;
  }

  // ── IVR AI Patch Requests (#254) ─────────────────────────────────────────────

  async createIvrAiPatch(tenantId: string, input: CreateIvrAiPatchInput): Promise<IvrAiPatchRequest> {
    const resolved = await this.resolveProvider('ivr_ai_patch', tenantId, input.provider_hint, input.intent, false);
    return this.repo.createIvrAiPatch(tenantId, {
      ...input,
      provider_hint: resolved.effective_provider_hint,
      metadata: {
        ...(input.metadata ?? {}),
        ai_policy: {
          requested_provider_hint: resolved.requested_provider_hint,
          effective_provider_hint: resolved.effective_provider_hint,
          provider_backed_requested: resolved.provider_backed_requested,
          provider_backed_allowed: resolved.provider_backed_allowed,
          fallback_reason: resolved.fallback_reason,
        },
      },
    });
  }

  listIvrAiPatches(tenantId: string, targetType: string, targetId: string): Promise<IvrAiPatchRequest[]> {
    return this.repo.listIvrAiPatches(tenantId, targetType, targetId);
  }

  async getIvrAiPatch(id: string, tenantId: string): Promise<IvrAiPatchRequest> {
    const request = await this.repo.findIvrAiPatch(id, tenantId);
    if (!request) throw new ProviderWorkRequestNotFoundError(id);
    return request;
  }

  async claimIvrAiPatch(id: string, input: ClaimWorkRequestInput): Promise<IvrAiPatchRequest> {
    const request = await this.repo.claimIvrAiPatch(id, input);
    if (!request) throw new ProviderWorkRequestNotFoundError(id);
    return request;
  }

  async completeIvrAiPatch(id: string, input: CompleteIvrAiPatchInput): Promise<IvrAiPatchRequest> {
    const request = await this.repo.completeIvrAiPatch(id, input);
    if (!request) throw new ProviderWorkRequestNotFoundError(id);
    return request;
  }

  async acceptIvrAiPatch(id: string, tenantId: string, decidedBy: string): Promise<IvrAiPatchRequest> {
    const request = await this.repo.acceptIvrAiPatch(id, decidedBy);
    if (!request) throw new ProviderWorkRequestNotFoundError(id);
    return request;
  }

  async rejectIvrAiPatch(id: string, tenantId: string, decidedBy: string): Promise<IvrAiPatchRequest> {
    const request = await this.repo.rejectIvrAiPatch(id, decidedBy);
    if (!request) throw new ProviderWorkRequestNotFoundError(id);
    return request;
  }

  private validateOutputs(outputs: string[]): void {
    if (!Array.isArray(outputs) || outputs.length === 0 || outputs.some((output) => output.length < 1)) {
      throw new Error('requested_outputs must contain at least one output');
    }
  }

  private mapToPolicyFeature(feature: 'prompt_generation' | 'ivr_ai_turn' | 'ivr_generation' | 'ivr_ai_patch'): 'prompt_generation' | 'ivr_ai_turn' | 'recording_analysis' {
    if (feature === 'ivr_generation' || feature === 'ivr_ai_patch') return 'ivr_ai_turn';
    return feature;
  }

  private async resolveProvider(
    feature: 'prompt_generation' | 'ivr_ai_turn' | 'ivr_generation' | 'ivr_ai_patch',
    tenantId: string,
    providerHint: IntegrationProvider | undefined,
    inputText: string | null | undefined,
    runtimeFallback: boolean,
  ) {
    if (!this.aiPolicyService) {
      return {
        requested_provider_hint: providerHint ?? 'auto',
        effective_provider_hint: providerHint ?? 'auto',
        provider_backed_requested: (providerHint ?? 'auto') !== 'auto',
        provider_backed_allowed: (providerHint ?? 'auto') !== 'auto',
        fallback_reason: providerHint ? null : 'requested_auto',
      };
    }
    const policyFeature = this.mapToPolicyFeature(feature);
    if (runtimeFallback) {
      return this.aiPolicyService.resolveProvider({
        tenant_id: tenantId,
        feature: policyFeature,
        requested_provider_hint: providerHint ?? 'auto',
        input_text: inputText,
      });
    }
    return this.aiPolicyService.requireProviderBackedAccess({
      tenant_id: tenantId,
      feature: policyFeature,
      requested_provider_hint: providerHint ?? 'auto',
      input_text: inputText,
    });
  }
}
