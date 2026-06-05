import type { Pool } from 'pg';
import type {
  PlatformAiPolicy,
  TenantAiPolicyOverride,
  UpdatePlatformAiPolicyInput,
  UpdateTenantAiPolicyInput,
} from './ai-policy.types.js';

const POLICY_KEY = 'ai_platform_policy';

export class AiPolicyRepository {
  constructor(private readonly db: Pool) {}

  async findPlatformPolicy(): Promise<PlatformAiPolicy | null> {
    const result = await this.db.query<{ value: string }>(
      `SELECT value FROM system_config WHERE key = $1`,
      [POLICY_KEY],
    );
    const raw = result.rows[0]?.value;
    return raw ? JSON.parse(raw) as PlatformAiPolicy : null;
  }

  async savePlatformPolicy(
    input: UpdatePlatformAiPolicyInput,
    actor: { actor_id: string | null; actor_role: string | null },
  ): Promise<PlatformAiPolicy> {
    const policy: PlatformAiPolicy = {
      provider_backed_enabled: input.provider_backed_enabled,
      deterministic_fallback_enabled: true,
      autonomous_runtime_mutation_allowed: false,
      human_approval_required_for_live_changes: true,
      feature_policies: input.feature_policies,
      updated_at: new Date().toISOString(),
      updated_by_actor_id: actor.actor_id,
      updated_by_actor_role: actor.actor_role,
    };

    await this.db.query(
      `INSERT INTO system_config (key, value)
       VALUES ($1, $2)
       ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [POLICY_KEY, JSON.stringify(policy)],
    );

    return policy;
  }

  async findTenantOverride(tenantId: string): Promise<TenantAiPolicyOverride | null> {
    const result = await this.db.query<TenantAiPolicyOverride>(
      `SELECT tenant_id, provider_backed_enabled, prompt_generation_enabled,
              prompt_generation_preferred_provider, ivr_ai_turn_enabled,
              ivr_ai_turn_preferred_provider, created_at, updated_at
       FROM tenant_ai_policy_overrides
       WHERE tenant_id = $1`,
      [tenantId],
    );
    return result.rows[0] ?? null;
  }

  async upsertTenantOverride(tenantId: string, input: UpdateTenantAiPolicyInput): Promise<TenantAiPolicyOverride> {
    const promptOverride = input.feature_overrides?.prompt_generation;
    const ivrOverride = input.feature_overrides?.ivr_ai_turn;
    const result = await this.db.query<TenantAiPolicyOverride>(
      `INSERT INTO tenant_ai_policy_overrides
         (tenant_id, provider_backed_enabled, prompt_generation_enabled, prompt_generation_preferred_provider,
          ivr_ai_turn_enabled, ivr_ai_turn_preferred_provider)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id)
       DO UPDATE SET provider_backed_enabled = EXCLUDED.provider_backed_enabled,
                     prompt_generation_enabled = EXCLUDED.prompt_generation_enabled,
                     prompt_generation_preferred_provider = EXCLUDED.prompt_generation_preferred_provider,
                     ivr_ai_turn_enabled = EXCLUDED.ivr_ai_turn_enabled,
                     ivr_ai_turn_preferred_provider = EXCLUDED.ivr_ai_turn_preferred_provider,
                     updated_at = NOW()
       RETURNING tenant_id, provider_backed_enabled, prompt_generation_enabled,
                 prompt_generation_preferred_provider, ivr_ai_turn_enabled,
                 ivr_ai_turn_preferred_provider, created_at, updated_at`,
      [
        tenantId,
        input.provider_backed_enabled,
        promptOverride?.enabled ?? false,
        promptOverride?.preferred_provider ?? null,
        ivrOverride?.enabled ?? false,
        ivrOverride?.preferred_provider ?? null,
      ],
    );
    return result.rows[0]!;
  }
}
