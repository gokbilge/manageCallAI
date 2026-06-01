import type { FraudRepository } from './fraud.repository.js';
import type {
  FraudBlockReason,
  FraudCheckResult,
  TenantOutboundPolicy,
  UpdateTenantOutboundPolicyInput,
} from './fraud.types.js';

// Global non-bypassable emergency prefixes (mirrors outbound-call.service constants)
const GLOBAL_EMERGENCY = new Set(['000', '110', '112', '118', '119', '911', '999']);
// Global non-bypassable premium-rate prefixes
const GLOBAL_PREMIUM_RATE = ['+1900', '1900', '+1976', '1976'];

export class FraudService {
  constructor(private readonly repo: FraudRepository) {}

  async getPolicy(tenantId: string): Promise<TenantOutboundPolicy | null> {
    return this.repo.getPolicy(tenantId);
  }

  async upsertPolicy(tenantId: string, input: UpdateTenantOutboundPolicyInput): Promise<TenantOutboundPolicy> {
    return this.repo.upsertPolicy(tenantId, input);
  }

  // Evaluates global + tenant-level fraud controls for a dial number.
  // Does NOT evaluate route-level policies (those remain in OutboundCallService).
  async checkOutboundCall(tenantId: string, dialNumber: string): Promise<FraudCheckResult> {
    // 1. Global emergency block (non-bypassable)
    const normalized = dialNumber.replace(/^\+/, '');
    if (GLOBAL_EMERGENCY.has(normalized)) {
      return blocked('global_emergency_block');
    }

    // 2. Global premium-rate block (non-bypassable)
    if (matchesAnyPrefix(dialNumber, GLOBAL_PREMIUM_RATE)) {
      return blocked('global_premium_rate_block');
    }

    const policy = await this.repo.getPolicy(tenantId);
    if (!policy) return { allowed: true };

    // 3. Tenant premium-rate blocklist
    if (matchesAnyPrefix(dialNumber, policy.premium_rate_blocklist)) {
      return blocked('tenant_premium_rate_block');
    }

    // 4. Tenant high-risk blocklist
    if (matchesAnyPrefix(dialNumber, policy.high_risk_blocklist)) {
      return blocked('tenant_high_risk_block');
    }

    // 5. Country/area-code allowlists (only checked when deny_international_default=true or lists non-empty)
    const countryList = policy.country_allowlist;
    const areaList = policy.areacode_allowlist;

    if (policy.deny_international_default || countryList.length > 0 || areaList.length > 0) {
      const combined = [...countryList, ...areaList];
      if (combined.length > 0 && !matchesAnyPrefix(dialNumber, combined)) {
        // Distinguish which list failed
        if (areaList.length > 0 && countryList.length === 0) {
          return blocked('tenant_areacode_not_allowed');
        }
        return blocked('tenant_country_not_allowed');
      }
      // deny_international_default with no allowlists = deny everything international
      if (policy.deny_international_default && combined.length === 0) {
        return blocked('tenant_country_not_allowed');
      }
    }

    // 6. Per-hour call limit
    if (policy.max_calls_per_hour !== null) {
      const hourlyCount = await this.repo.countCallsInWindow(tenantId, 3600);
      if (hourlyCount >= policy.max_calls_per_hour) {
        return blocked('tenant_hourly_limit_exceeded');
      }
    }

    // 7. Per-day call limit
    if (policy.max_calls_per_day !== null) {
      const dailyCount = await this.repo.countCallsInWindow(tenantId, 86400);
      if (dailyCount >= policy.max_calls_per_day) {
        return blocked('tenant_daily_limit_exceeded');
      }
    }

    return { allowed: true };
  }
}

function blocked(reason: FraudBlockReason): FraudCheckResult {
  return { allowed: false, reason };
}

function matchesAnyPrefix(dialNumber: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => dialNumber.startsWith(p));
}
