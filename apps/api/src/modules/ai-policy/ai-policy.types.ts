import type { IntegrationProvider } from '../provider-work/provider-work.types.js';

export type AiFeature = 'prompt_generation' | 'ivr_ai_turn' | 'recording_analysis';
export type NonAutoIntegrationProvider = Exclude<IntegrationProvider, 'auto'>;

export interface AiFeaturePolicy {
  enabled: boolean;
  allowed_providers: NonAutoIntegrationProvider[];
  allowed_models: string[];
  max_input_characters: number | null;
}

export interface PlatformAiPolicy {
  provider_backed_enabled: boolean;
  deterministic_fallback_enabled: true;
  autonomous_runtime_mutation_allowed: false;
  human_approval_required_for_live_changes: true;
  feature_policies: Record<AiFeature, AiFeaturePolicy>;
  updated_at: string;
  updated_by_actor_id: string | null;
  updated_by_actor_role: string | null;
}

export interface TenantAiPolicyOverride {
  tenant_id: string;
  provider_backed_enabled: boolean;
  prompt_generation_enabled: boolean;
  prompt_generation_preferred_provider: NonAutoIntegrationProvider | null;
  ivr_ai_turn_enabled: boolean;
  ivr_ai_turn_preferred_provider: NonAutoIntegrationProvider | null;
  recording_analysis_enabled: boolean;
  recording_analysis_preferred_provider: NonAutoIntegrationProvider | null;
  created_at: string;
  updated_at: string;
}

export interface TenantAiPolicy {
  tenant_id: string;
  provider_backed_enabled: boolean;
  deterministic_fallback_enabled: true;
  autonomous_runtime_mutation_allowed: false;
  human_approval_required_for_live_changes: true;
  feature_policies: Record<AiFeature, {
    enabled: boolean;
    allowed_providers: NonAutoIntegrationProvider[];
    allowed_models: string[];
    preferred_provider: NonAutoIntegrationProvider | null;
    max_input_characters: number | null;
  }>;
  updated_at: string;
}

export interface UpdatePlatformAiPolicyInput {
  provider_backed_enabled: boolean;
  deterministic_fallback_enabled?: true;
  autonomous_runtime_mutation_allowed?: false;
  human_approval_required_for_live_changes?: true;
  feature_policies: Record<AiFeature, AiFeaturePolicy>;
}

export interface UpdateTenantAiPolicyInput {
  provider_backed_enabled: boolean;
  feature_overrides?: Partial<Record<AiFeature, {
    enabled: boolean;
    preferred_provider?: NonAutoIntegrationProvider | null;
  }>>;
}

export interface ResolveAiProviderInput {
  tenant_id: string;
  feature: AiFeature;
  requested_provider_hint?: IntegrationProvider | null;
  input_text?: string | null;
}

export interface ResolvedAiProviderDecision {
  requested_provider_hint: IntegrationProvider;
  effective_provider_hint: IntegrationProvider;
  provider_backed_requested: boolean;
  provider_backed_allowed: boolean;
  fallback_reason:
    | 'requested_auto'
    | 'platform_provider_backed_disabled'
    | 'tenant_provider_backed_disabled'
    | 'feature_disabled'
    | 'provider_not_allowed'
    | 'input_too_large'
    | null;
  policy: TenantAiPolicy;
}
