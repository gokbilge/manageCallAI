import type { Pool } from 'pg';
import type { TenantOutboundPolicy, UpdateTenantOutboundPolicyInput } from './fraud.types.js';

export class FraudRepository {
  constructor(private readonly db: Pool) {}

  async getPolicy(tenantId: string): Promise<TenantOutboundPolicy | null> {
    const r = await this.db.query<TenantOutboundPolicy>(
      `SELECT id, tenant_id, country_allowlist, areacode_allowlist,
              premium_rate_blocklist, high_risk_blocklist,
              max_calls_per_hour, max_calls_per_day, max_call_duration_secs,
              deny_international_default, created_at, updated_at
       FROM tenant_outbound_policies WHERE tenant_id = $1`,
      [tenantId],
    );
    return r.rows[0] ?? null;
  }

  async upsertPolicy(tenantId: string, input: UpdateTenantOutboundPolicyInput): Promise<TenantOutboundPolicy> {
    const r = await this.db.query<TenantOutboundPolicy>(
      `INSERT INTO tenant_outbound_policies
         (tenant_id, country_allowlist, areacode_allowlist,
          premium_rate_blocklist, high_risk_blocklist,
          max_calls_per_hour, max_calls_per_day, max_call_duration_secs,
          deny_international_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (tenant_id) DO UPDATE
         SET country_allowlist          = COALESCE($2, tenant_outbound_policies.country_allowlist),
             areacode_allowlist         = COALESCE($3, tenant_outbound_policies.areacode_allowlist),
             premium_rate_blocklist     = COALESCE($4, tenant_outbound_policies.premium_rate_blocklist),
             high_risk_blocklist        = COALESCE($5, tenant_outbound_policies.high_risk_blocklist),
             max_calls_per_hour         = $6,
             max_calls_per_day          = $7,
             max_call_duration_secs     = $8,
             deny_international_default = COALESCE($9, tenant_outbound_policies.deny_international_default),
             updated_at                 = NOW()
       RETURNING id, tenant_id, country_allowlist, areacode_allowlist,
                 premium_rate_blocklist, high_risk_blocklist,
                 max_calls_per_hour, max_calls_per_day, max_call_duration_secs,
                 deny_international_default, created_at, updated_at`,
      [
        tenantId,
        input.country_allowlist ?? [],
        input.areacode_allowlist ?? [],
        input.premium_rate_blocklist ?? [],
        input.high_risk_blocklist ?? [],
        input.max_calls_per_hour ?? null,
        input.max_calls_per_day ?? null,
        input.max_call_duration_secs ?? null,
        input.deny_international_default ?? false,
      ],
    );
    return r.rows[0]!;
  }

  async countCallsInWindow(tenantId: string, windowSeconds: number): Promise<number> {
    const r = await this.db.query<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM outbound_call_requests
       WHERE tenant_id = $1
         AND created_at >= NOW() - ($2 || ' seconds')::interval
         AND status NOT IN ('failed', 'expired')`,
      [tenantId, windowSeconds],
    );
    return parseInt(r.rows[0]?.cnt ?? '0', 10);
  }
}
