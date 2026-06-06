import { describe, expect, it, vi } from 'vitest';
import type { AiPolicyRepository } from './ai-policy.repository.js';
import { AiPolicyService, AiProviderRequestDeniedError, AiPolicyValidationError } from './ai-policy.service.js';

function makeRepo(): AiPolicyRepository {
  return {
    findPlatformPolicy: vi.fn().mockResolvedValue(null),
    savePlatformPolicy: vi.fn(),
    findTenantOverride: vi.fn().mockResolvedValue(null),
    upsertTenantOverride: vi.fn(),
  } as unknown as AiPolicyRepository;
}

describe('AiPolicyService', () => {
  it('returns deterministic-only defaults when no persisted policy exists', async () => {
    const service = new AiPolicyService(makeRepo());
    const policy = await service.getTenantPolicy('tenant-1');

    expect(policy.provider_backed_enabled).toBe(false);
    expect(policy.feature_policies.prompt_generation.enabled).toBe(false);
    expect(policy.feature_policies.ivr_ai_turn.allowed_providers).toContain('openai');
    expect(policy.feature_policies.recording_analysis.allowed_providers).toContain('whisper');
    expect(policy.deterministic_fallback_enabled).toBe(true);
  });

  it('rejects tenant preferred providers outside platform policy', async () => {
    const repo = makeRepo();
    vi.mocked(repo.findPlatformPolicy).mockResolvedValue({
      provider_backed_enabled: true,
      deterministic_fallback_enabled: true,
      autonomous_runtime_mutation_allowed: false,
      human_approval_required_for_live_changes: true,
      feature_policies: {
        prompt_generation: {
          enabled: true,
          allowed_providers: ['openai'],
          allowed_models: ['gpt-4.1-mini'],
          max_input_characters: 1000,
        },
        ivr_ai_turn: {
          enabled: false,
          allowed_providers: ['openai'],
          allowed_models: [],
          max_input_characters: 500,
        },
        recording_analysis: {
          enabled: true,
          allowed_providers: ['openai', 'whisper'],
          allowed_models: ['gpt-4.1-mini', 'whisper-1'],
          max_input_characters: null,
        },
      },
      updated_at: '2026-06-05T00:00:00.000Z',
      updated_by_actor_id: 'actor-1',
      updated_by_actor_role: 'platform_admin',
    });
    const service = new AiPolicyService(repo);

    await expect(service.updateTenantPolicy('tenant-1', {
      provider_backed_enabled: true,
      feature_overrides: {
        prompt_generation: {
          enabled: true,
          preferred_provider: 'external',
        },
      },
    })).rejects.toBeInstanceOf(AiPolicyValidationError);
  });

  it('denies explicit provider-backed requests when tenant policy does not allow them', async () => {
    const service = new AiPolicyService(makeRepo());

    await expect(service.requireProviderBackedAccess({
      tenant_id: 'tenant-1',
      feature: 'prompt_generation',
      requested_provider_hint: 'openai',
      input_text: 'Welcome to Acme',
    })).rejects.toBeInstanceOf(AiProviderRequestDeniedError);
  });

  it('allows explicit provider-backed requests when platform and tenant policies both allow them', async () => {
    const repo = makeRepo();
    vi.mocked(repo.findPlatformPolicy).mockResolvedValue({
      provider_backed_enabled: true,
      deterministic_fallback_enabled: true,
      autonomous_runtime_mutation_allowed: false,
      human_approval_required_for_live_changes: true,
      feature_policies: {
        prompt_generation: {
          enabled: true,
          allowed_providers: ['openai', 'external'],
          allowed_models: ['gpt-4.1-mini'],
          max_input_characters: 1000,
        },
        ivr_ai_turn: {
          enabled: true,
          allowed_providers: ['openai'],
          allowed_models: ['gpt-4.1-mini'],
          max_input_characters: 500,
        },
        recording_analysis: {
          enabled: true,
          allowed_providers: ['openai', 'whisper'],
          allowed_models: ['gpt-4.1-mini', 'whisper-1'],
          max_input_characters: null,
        },
      },
      updated_at: '2026-06-05T00:00:00.000Z',
      updated_by_actor_id: 'actor-1',
      updated_by_actor_role: 'platform_admin',
    });
    vi.mocked(repo.findTenantOverride).mockResolvedValue({
      tenant_id: 'tenant-1',
      provider_backed_enabled: true,
      prompt_generation_enabled: true,
      prompt_generation_preferred_provider: 'openai',
      ivr_ai_turn_enabled: false,
      ivr_ai_turn_preferred_provider: null,
      recording_analysis_enabled: false,
      recording_analysis_preferred_provider: null,
      created_at: '2026-06-05T00:00:00.000Z',
      updated_at: '2026-06-05T00:00:00.000Z',
    });
    const service = new AiPolicyService(repo);

    const decision = await service.requireProviderBackedAccess({
      tenant_id: 'tenant-1',
      feature: 'prompt_generation',
      requested_provider_hint: 'openai',
      input_text: 'Welcome to Acme',
    });

    expect(decision.provider_backed_allowed).toBe(true);
    expect(decision.effective_provider_hint).toBe('openai');
  });

  it('resolves provider-backed recording analysis when tenant policy allows it', async () => {
    const repo = makeRepo();
    vi.mocked(repo.findPlatformPolicy).mockResolvedValue({
      provider_backed_enabled: true,
      deterministic_fallback_enabled: true,
      autonomous_runtime_mutation_allowed: false,
      human_approval_required_for_live_changes: true,
      feature_policies: {
        prompt_generation: {
          enabled: true,
          allowed_providers: ['openai'],
          allowed_models: ['gpt-4.1-mini'],
          max_input_characters: 1000,
        },
        ivr_ai_turn: {
          enabled: true,
          allowed_providers: ['openai'],
          allowed_models: ['gpt-4.1-mini'],
          max_input_characters: 500,
        },
        recording_analysis: {
          enabled: true,
          allowed_providers: ['openai', 'whisper'],
          allowed_models: ['gpt-4.1-mini', 'whisper-1'],
          max_input_characters: null,
        },
      },
      updated_at: '2026-06-05T00:00:00.000Z',
      updated_by_actor_id: 'actor-1',
      updated_by_actor_role: 'platform_admin',
    });
    vi.mocked(repo.findTenantOverride).mockResolvedValue({
      tenant_id: 'tenant-1',
      provider_backed_enabled: true,
      prompt_generation_enabled: false,
      prompt_generation_preferred_provider: null,
      ivr_ai_turn_enabled: false,
      ivr_ai_turn_preferred_provider: null,
      recording_analysis_enabled: true,
      recording_analysis_preferred_provider: 'whisper',
      created_at: '2026-06-05T00:00:00.000Z',
      updated_at: '2026-06-05T00:00:00.000Z',
    });
    const service = new AiPolicyService(repo);

    const decision = await service.requireProviderBackedAccess({
      tenant_id: 'tenant-1',
      feature: 'recording_analysis',
      requested_provider_hint: 'whisper',
      input_text: 'transcript,summary',
    });

    expect(decision.provider_backed_allowed).toBe(true);
    expect(decision.effective_provider_hint).toBe('whisper');
  });
});
