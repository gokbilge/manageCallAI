import type { AuthClaims } from '../auth/auth-claims.js';
import type { IntegrationProvider } from '../provider-work/provider-work.types.js';
import type {
  PlatformAiPolicy,
  ResolveAiProviderInput,
  ResolvedAiProviderDecision,
  TenantAiPolicy,
  TenantAiPolicyOverride,
  UpdatePlatformAiPolicyInput,
  UpdateTenantAiPolicyInput,
} from './ai-policy.types.js';
import type { AiFeature, NonAutoIntegrationProvider } from './ai-policy.types.js';
import type { AiPolicyRepository } from './ai-policy.repository.js';

const PROMPT_PROVIDERS: readonly NonAutoIntegrationProvider[] = ['openai', 'elevenlabs', 'external', 'custom'];
const IVR_AI_PROVIDERS: readonly NonAutoIntegrationProvider[] = ['openai', 'external', 'custom'];

export class AiPolicyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiPolicyValidationError';
  }
}

export class AiProviderRequestDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiProviderRequestDeniedError';
  }
}

export class AiPolicyService {
  constructor(private readonly repo: AiPolicyRepository) {}

  async getPlatformPolicy(): Promise<PlatformAiPolicy> {
    return (await this.repo.findPlatformPolicy()) ?? defaultPlatformPolicy();
  }

  async updatePlatformPolicy(input: UpdatePlatformAiPolicyInput, actor: AuthClaims): Promise<PlatformAiPolicy> {
    this.validatePlatformPolicy(input);
    return this.repo.savePlatformPolicy(input, {
      actor_id: actor.sub,
      actor_role: actor.role ?? null,
    });
  }

  async getTenantPolicy(tenantId: string): Promise<TenantAiPolicy> {
    const [platform, override] = await Promise.all([
      this.getPlatformPolicy(),
      this.repo.findTenantOverride(tenantId),
    ]);
    return this.buildTenantPolicy(tenantId, platform, override);
  }

  async updateTenantPolicy(tenantId: string, input: UpdateTenantAiPolicyInput): Promise<TenantAiPolicy> {
    const platform = await this.getPlatformPolicy();
    this.validateTenantOverride(input, platform);
    await this.repo.upsertTenantOverride(tenantId, input);
    const override = await this.repo.findTenantOverride(tenantId);
    return this.buildTenantPolicy(tenantId, platform, override);
  }

  async requireProviderBackedAccess(input: ResolveAiProviderInput): Promise<ResolvedAiProviderDecision> {
    const decision = await this.resolveProvider(input);
    if (decision.provider_backed_requested && !decision.provider_backed_allowed) {
      throw new AiProviderRequestDeniedError(this.describeFallbackReason(decision.fallback_reason));
    }
    return decision;
  }

  async resolveProvider(input: ResolveAiProviderInput): Promise<ResolvedAiProviderDecision> {
    const policy = await this.getTenantPolicy(input.tenant_id);
    const requestedProviderHint = input.requested_provider_hint ?? 'auto';
    const featurePolicy = policy.feature_policies[input.feature];

    if (requestedProviderHint === 'auto') {
      return {
        requested_provider_hint: 'auto',
        effective_provider_hint: 'auto',
        provider_backed_requested: false,
        provider_backed_allowed: false,
        fallback_reason: 'requested_auto',
        policy,
      };
    }

    if (!policy.provider_backed_enabled) {
      return this.fallbackDecision(policy, requestedProviderHint, 'tenant_provider_backed_disabled');
    }
    if (!featurePolicy.enabled) {
      return this.fallbackDecision(policy, requestedProviderHint, 'feature_disabled');
    }
    if (featurePolicy.max_input_characters !== null && (input.input_text?.length ?? 0) > featurePolicy.max_input_characters) {
      return this.fallbackDecision(policy, requestedProviderHint, 'input_too_large');
    }
    if (!featurePolicy.allowed_providers.includes(requestedProviderHint as NonAutoIntegrationProvider)) {
      return this.fallbackDecision(policy, requestedProviderHint, 'provider_not_allowed');
    }

    return {
      requested_provider_hint: requestedProviderHint,
      effective_provider_hint: requestedProviderHint,
      provider_backed_requested: true,
      provider_backed_allowed: true,
      fallback_reason: null,
      policy,
    };
  }

  private fallbackDecision(
    policy: TenantAiPolicy,
    requestedProviderHint: IntegrationProvider,
    reason: ResolvedAiProviderDecision['fallback_reason'],
  ): ResolvedAiProviderDecision {
    return {
      requested_provider_hint: requestedProviderHint,
      effective_provider_hint: 'auto',
      provider_backed_requested: requestedProviderHint !== 'auto',
      provider_backed_allowed: false,
      fallback_reason: reason,
      policy,
    };
  }

  private validatePlatformPolicy(input: UpdatePlatformAiPolicyInput): void {
    if (input.deterministic_fallback_enabled !== undefined && input.deterministic_fallback_enabled !== true) {
      throw new AiPolicyValidationError('deterministic fallback must remain enabled');
    }
    for (const feature of Object.keys(input.feature_policies) as AiFeature[]) {
      const policy = input.feature_policies[feature];
      if (policy.allowed_models.some((model) => model.trim().length === 0)) {
        throw new AiPolicyValidationError(`${feature} allowed_models cannot contain empty values`);
      }
    }
  }

  private validateTenantOverride(input: UpdateTenantAiPolicyInput, platform: PlatformAiPolicy): void {
    for (const [feature, override] of Object.entries(input.feature_overrides ?? {}) as [AiFeature, NonNullable<UpdateTenantAiPolicyInput['feature_overrides']>[AiFeature]][]) {
      if (!override) continue;
      const platformFeature = platform.feature_policies[feature];
      if (override.preferred_provider && !platformFeature.allowed_providers.includes(override.preferred_provider)) {
        throw new AiPolicyValidationError(`${feature} preferred provider is not allowed by platform policy`);
      }
    }
  }

  private buildTenantPolicy(
    tenantId: string,
    platform: PlatformAiPolicy,
    override: TenantAiPolicyOverride | null,
  ): TenantAiPolicy {
    const providerBackedEnabled = platform.provider_backed_enabled && (override?.provider_backed_enabled ?? false);
    const promptPolicy = platform.feature_policies.prompt_generation;
    const ivrPolicy = platform.feature_policies.ivr_ai_turn;

    return {
      tenant_id: tenantId,
      provider_backed_enabled: providerBackedEnabled,
      deterministic_fallback_enabled: true,
      autonomous_runtime_mutation_allowed: false,
      human_approval_required_for_live_changes: true,
      feature_policies: {
        prompt_generation: {
          enabled: providerBackedEnabled && promptPolicy.enabled && (override?.prompt_generation_enabled ?? false),
          allowed_providers: promptPolicy.allowed_providers,
          allowed_models: promptPolicy.allowed_models,
          preferred_provider: resolvePreferredProvider(promptPolicy.allowed_providers, override?.prompt_generation_preferred_provider ?? null),
          max_input_characters: promptPolicy.max_input_characters,
        },
        ivr_ai_turn: {
          enabled: providerBackedEnabled && ivrPolicy.enabled && (override?.ivr_ai_turn_enabled ?? false),
          allowed_providers: ivrPolicy.allowed_providers,
          allowed_models: ivrPolicy.allowed_models,
          preferred_provider: resolvePreferredProvider(ivrPolicy.allowed_providers, override?.ivr_ai_turn_preferred_provider ?? null),
          max_input_characters: ivrPolicy.max_input_characters,
        },
      },
      updated_at: normalizeIsoTimestamp(override?.updated_at ?? platform.updated_at),
    };
  }

  private describeFallbackReason(reason: ResolvedAiProviderDecision['fallback_reason']): string {
    switch (reason) {
      case 'tenant_provider_backed_disabled':
        return 'Provider-backed AI is disabled for this tenant';
      case 'feature_disabled':
        return 'Provider-backed AI is disabled for this feature';
      case 'provider_not_allowed':
        return 'Requested provider is not allowed by policy';
      case 'input_too_large':
        return 'Input exceeds the policy limit for provider-backed AI';
      case 'platform_provider_backed_disabled':
        return 'Provider-backed AI is disabled by platform policy';
      default:
        return 'Provider-backed AI request is not allowed by policy';
    }
  }
}

function normalizeIsoTimestamp(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function resolvePreferredProvider(
  allowedProviders: readonly NonAutoIntegrationProvider[],
  preferredProvider: NonAutoIntegrationProvider | null,
): NonAutoIntegrationProvider | null {
  if (!preferredProvider) return null;
  return allowedProviders.includes(preferredProvider) ? preferredProvider : null;
}

function defaultPlatformPolicy(): PlatformAiPolicy {
  return {
    provider_backed_enabled: false,
    deterministic_fallback_enabled: true,
    autonomous_runtime_mutation_allowed: false,
    human_approval_required_for_live_changes: true,
    feature_policies: {
      prompt_generation: {
        enabled: false,
        allowed_providers: [...PROMPT_PROVIDERS],
        allowed_models: [],
        max_input_characters: 4000,
      },
      ivr_ai_turn: {
        enabled: false,
        allowed_providers: [...IVR_AI_PROVIDERS],
        allowed_models: [],
        max_input_characters: 2000,
      },
    },
    updated_at: new Date(0).toISOString(),
    updated_by_actor_id: null,
    updated_by_actor_role: null,
  };
}
