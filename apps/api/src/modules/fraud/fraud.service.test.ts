import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FraudService } from './fraud.service.js';
import type { FraudRepository } from './fraud.repository.js';
import type { TenantOutboundPolicy } from './fraud.types.js';

const TENANT = 'tenant-1';

const basePolicy: TenantOutboundPolicy = {
  id: 'policy-1',
  tenant_id: TENANT,
  country_allowlist: [],
  areacode_allowlist: [],
  premium_rate_blocklist: [],
  high_risk_blocklist: [],
  max_calls_per_hour: null,
  max_calls_per_day: null,
  max_call_duration_secs: null,
  deny_international_default: false,
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
};

function makeRepo(overrides: Partial<FraudRepository> = {}): FraudRepository {
  return {
    getPolicy: vi.fn().mockResolvedValue(basePolicy),
    upsertPolicy: vi.fn().mockResolvedValue(basePolicy),
    countCallsInWindow: vi.fn().mockResolvedValue(0),
    ...overrides,
  } as unknown as FraudRepository;
}

describe('FraudService.checkOutboundCall', () => {
  let repo: FraudRepository;
  let service: FraudService;

  beforeEach(() => {
    repo = makeRepo();
    service = new FraudService(repo);
  });

  // ── Global blocks (non-bypassable) ───────────────────────────────────────

  it('blocks 911 globally regardless of tenant policy', async () => {
    const result = await service.checkOutboundCall(TENANT, '911');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('global_emergency_block');
    expect(repo.getPolicy).not.toHaveBeenCalled();
  });

  it('blocks all emergency numbers globally', async () => {
    for (const num of ['000', '110', '112', '118', '119', '999']) {
      const r = await service.checkOutboundCall(TENANT, num);
      expect(r.allowed).toBe(false);
      expect(r.reason).toBe('global_emergency_block');
    }
  });

  it('blocks global premium-rate prefixes (+1900) regardless of tenant policy', async () => {
    const result = await service.checkOutboundCall(TENANT, '+19005551234');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('global_premium_rate_block');
  });

  it('blocks 1976 (no plus) as premium-rate', async () => {
    const result = await service.checkOutboundCall(TENANT, '19765551234');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('global_premium_rate_block');
  });

  // ── No policy (new tenant) ────────────────────────────────────────────────

  it('allows any non-blocked call when tenant has no policy', async () => {
    repo = makeRepo({ getPolicy: vi.fn().mockResolvedValue(null) });
    service = new FraudService(repo);
    const result = await service.checkOutboundCall(TENANT, '+905551234567');
    expect(result.allowed).toBe(true);
  });

  // ── Tenant blocklists ─────────────────────────────────────────────────────

  it('blocks tenant premium-rate prefixes', async () => {
    repo = makeRepo({
      getPolicy: vi.fn().mockResolvedValue({ ...basePolicy, premium_rate_blocklist: ['+9090'] }),
    });
    service = new FraudService(repo);
    const result = await service.checkOutboundCall(TENANT, '+90905551234');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('tenant_premium_rate_block');
  });

  it('blocks tenant high-risk prefixes', async () => {
    repo = makeRepo({
      getPolicy: vi.fn().mockResolvedValue({ ...basePolicy, high_risk_blocklist: ['+357'] }),
    });
    service = new FraudService(repo);
    const result = await service.checkOutboundCall(TENANT, '+35799999999');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('tenant_high_risk_block');
  });

  // ── Country/area-code allowlists ─────────────────────────────────────────

  it('allows destination matching country_allowlist', async () => {
    repo = makeRepo({
      getPolicy: vi.fn().mockResolvedValue({ ...basePolicy, country_allowlist: ['+1', '+90'] }),
    });
    service = new FraudService(repo);
    const result = await service.checkOutboundCall(TENANT, '+905551234567');
    expect(result.allowed).toBe(true);
  });

  it('blocks destination outside country_allowlist', async () => {
    repo = makeRepo({
      getPolicy: vi.fn().mockResolvedValue({ ...basePolicy, country_allowlist: ['+1'] }),
    });
    service = new FraudService(repo);
    const result = await service.checkOutboundCall(TENANT, '+44701234567');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('tenant_country_not_allowed');
  });

  it('allows destination matching areacode_allowlist', async () => {
    repo = makeRepo({
      getPolicy: vi.fn().mockResolvedValue({ ...basePolicy, areacode_allowlist: ['+1415'] }),
    });
    service = new FraudService(repo);
    const result = await service.checkOutboundCall(TENANT, '+14155550100');
    expect(result.allowed).toBe(true);
  });

  it('blocks destination outside areacode_allowlist', async () => {
    repo = makeRepo({
      getPolicy: vi.fn().mockResolvedValue({ ...basePolicy, areacode_allowlist: ['+1415'] }),
    });
    service = new FraudService(repo);
    const result = await service.checkOutboundCall(TENANT, '+12125550100');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('tenant_areacode_not_allowed');
  });

  it('blocks any call when deny_international_default=true and no allowlists', async () => {
    repo = makeRepo({
      getPolicy: vi.fn().mockResolvedValue({ ...basePolicy, deny_international_default: true }),
    });
    service = new FraudService(repo);
    const result = await service.checkOutboundCall(TENANT, '+905551234567');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('tenant_country_not_allowed');
  });

  // ── Attempt limits ────────────────────────────────────────────────────────

  it('allows call when hourly count is below the limit', async () => {
    repo = makeRepo({
      getPolicy: vi.fn().mockResolvedValue({ ...basePolicy, max_calls_per_hour: 10 }),
      countCallsInWindow: vi.fn().mockResolvedValue(5),
    });
    service = new FraudService(repo);
    const result = await service.checkOutboundCall(TENANT, '+905551234567');
    expect(result.allowed).toBe(true);
  });

  it('blocks call when hourly limit is reached', async () => {
    repo = makeRepo({
      getPolicy: vi.fn().mockResolvedValue({ ...basePolicy, max_calls_per_hour: 10 }),
      countCallsInWindow: vi.fn().mockResolvedValue(10),
    });
    service = new FraudService(repo);
    const result = await service.checkOutboundCall(TENANT, '+905551234567');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('tenant_hourly_limit_exceeded');
    expect(repo.countCallsInWindow).toHaveBeenCalledWith(TENANT, 3600);
  });

  it('blocks call when daily limit is reached', async () => {
    repo = makeRepo({
      getPolicy: vi.fn().mockResolvedValue({ ...basePolicy, max_calls_per_day: 50 }),
      countCallsInWindow: vi.fn().mockResolvedValue(50),
    });
    service = new FraudService(repo);
    const result = await service.checkOutboundCall(TENANT, '+905551234567');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('tenant_daily_limit_exceeded');
    expect(repo.countCallsInWindow).toHaveBeenCalledWith(TENANT, 86400);
  });

  // ── Policy is deterministic (pure evaluation) ────────────────────────────

  it('emergency block is evaluated before any policy fetch', async () => {
    const result = await service.checkOutboundCall(TENANT, '112');
    expect(result.allowed).toBe(false);
    expect(repo.getPolicy).not.toHaveBeenCalled();
  });

  it('blocked call does not proceed to db persistence (service returns blocked result)', async () => {
    const result = await service.checkOutboundCall(TENANT, '911');
    expect(result.allowed).toBe(false);
    // Caller (OutboundCallService) is responsible for not persisting on false
  });
});

describe('FraudService.upsertPolicy', () => {
  it('delegates to repository and returns the policy', async () => {
    const repo = makeRepo();
    const service = new FraudService(repo);
    const policy = await service.upsertPolicy(TENANT, { max_calls_per_hour: 100 });
    expect(policy.tenant_id).toBe(TENANT);
    expect(repo.upsertPolicy).toHaveBeenCalledWith(TENANT, { max_calls_per_hour: 100 });
  });
});
