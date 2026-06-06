import { z } from '../registry.js';
import { IntegrationProviderSchema } from './provider-work.js';

export const AiFeatureSchema = z.enum(['prompt_generation', 'ivr_ai_turn', 'recording_analysis']);
export type AiFeature = z.infer<typeof AiFeatureSchema>;

const NonAutoIntegrationProviderSchema = z.enum(['openai', 'elevenlabs', 'whisper', 'external', 'custom']);
export type NonAutoIntegrationProvider = z.infer<typeof NonAutoIntegrationProviderSchema>;

export const AiFeaturePolicySchema = z.object({
  enabled: z.boolean(),
  allowed_providers: z.array(NonAutoIntegrationProviderSchema).min(1),
  allowed_models: z.array(z.string().min(1).max(255)),
  max_input_characters: z.number().int().positive().nullable(),
}).openapi('AiFeaturePolicy');
export type AiFeaturePolicy = z.infer<typeof AiFeaturePolicySchema>;

export const PlatformAiPolicySchema = z.object({
  provider_backed_enabled: z.boolean(),
  deterministic_fallback_enabled: z.literal(true),
  autonomous_runtime_mutation_allowed: z.literal(false),
  human_approval_required_for_live_changes: z.literal(true),
  feature_policies: z.object({
    prompt_generation: AiFeaturePolicySchema,
    ivr_ai_turn: AiFeaturePolicySchema,
    recording_analysis: AiFeaturePolicySchema,
  }),
  updated_at: z.string().datetime(),
  updated_by_actor_id: z.string().nullable(),
  updated_by_actor_role: z.string().nullable(),
}).openapi('PlatformAiPolicy');
export type PlatformAiPolicy = z.infer<typeof PlatformAiPolicySchema>;

export const UpdatePlatformAiPolicyBodySchema = z.object({
  provider_backed_enabled: z.boolean(),
  deterministic_fallback_enabled: z.literal(true).optional(),
  autonomous_runtime_mutation_allowed: z.literal(false).optional(),
  human_approval_required_for_live_changes: z.literal(true).optional(),
  feature_policies: z.object({
    prompt_generation: AiFeaturePolicySchema,
    ivr_ai_turn: AiFeaturePolicySchema,
    recording_analysis: AiFeaturePolicySchema,
  }),
}).openapi('UpdatePlatformAiPolicyBody');
export type UpdatePlatformAiPolicyBody = z.infer<typeof UpdatePlatformAiPolicyBodySchema>;

export const TenantAiFeaturePolicySchema = z.object({
  enabled: z.boolean(),
  allowed_providers: z.array(NonAutoIntegrationProviderSchema),
  allowed_models: z.array(z.string().min(1).max(255)),
  preferred_provider: NonAutoIntegrationProviderSchema.nullable(),
  max_input_characters: z.number().int().positive().nullable(),
}).openapi('TenantAiFeaturePolicy');
export type TenantAiFeaturePolicy = z.infer<typeof TenantAiFeaturePolicySchema>;

export const TenantAiPolicySchema = z.object({
  tenant_id: z.string().uuid(),
  provider_backed_enabled: z.boolean(),
  deterministic_fallback_enabled: z.literal(true),
  autonomous_runtime_mutation_allowed: z.literal(false),
  human_approval_required_for_live_changes: z.literal(true),
  feature_policies: z.object({
    prompt_generation: TenantAiFeaturePolicySchema,
    ivr_ai_turn: TenantAiFeaturePolicySchema,
    recording_analysis: TenantAiFeaturePolicySchema,
  }),
  updated_at: z.string().datetime(),
}).openapi('TenantAiPolicy');
export type TenantAiPolicy = z.infer<typeof TenantAiPolicySchema>;

export const UpdateTenantAiPolicyBodySchema = z.object({
  provider_backed_enabled: z.boolean(),
  feature_overrides: z.object({
    prompt_generation: z.object({
      enabled: z.boolean(),
      preferred_provider: NonAutoIntegrationProviderSchema.nullable().optional(),
    }).optional(),
    ivr_ai_turn: z.object({
      enabled: z.boolean(),
      preferred_provider: NonAutoIntegrationProviderSchema.nullable().optional(),
    }).optional(),
    recording_analysis: z.object({
      enabled: z.boolean(),
      preferred_provider: NonAutoIntegrationProviderSchema.nullable().optional(),
    }).optional(),
  }).default({}),
}).openapi('UpdateTenantAiPolicyBody');
export type UpdateTenantAiPolicyBody = z.infer<typeof UpdateTenantAiPolicyBodySchema>;

export const IntegrationProviderHintSchema = IntegrationProviderSchema;
