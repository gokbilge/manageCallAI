import { describe, expect, it } from 'vitest';
import { InMemoryRateLimiter, policyForPath, evaluateRateLimitTopology, type TopologyConfig } from './rate-limit.js';

// ── Topology baseline ──────────────────────────────────────────────────────
const singleInstanceProduction: TopologyConfig = {
  appEnv: 'production',
  instanceCount: 1,
  externalEnforced: false,
  gatewayEnforced: false,
  explicitRateLimits: true,
  explicitWindow: true,
  storeNamed: false,
};

const multiInstanceExternal: TopologyConfig = {
  ...singleInstanceProduction,
  instanceCount: 3,
  externalEnforced: true,
  storeNamed: true,
};

const multiInstanceGateway: TopologyConfig = {
  ...singleInstanceProduction,
  instanceCount: 2,
  gatewayEnforced: true,
};

const multiInstanceUnsafe: TopologyConfig = {
  ...singleInstanceProduction,
  instanceCount: 2,
  externalEnforced: false,
  gatewayEnforced: false,
};

describe('InMemoryRateLimiter', () => {
  it('allows requests up to the configured limit and then denies', () => {
    let now = 1_000;
    const limiter = new InMemoryRateLimiter(() => now);
    const policy = { name: 'auth', limit: 2, windowMs: 60_000 };

    expect(limiter.take('auth:127.0.0.1', policy)).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.take('auth:127.0.0.1', policy)).toMatchObject({ allowed: true, remaining: 0 });
    expect(limiter.take('auth:127.0.0.1', policy)).toMatchObject({ allowed: false, remaining: 0 });

    now += 60_001;

    expect(limiter.take('auth:127.0.0.1', policy)).toMatchObject({ allowed: true, remaining: 1 });
  });
});

describe('policyForPath', () => {
  it('classifies specific edge surfaces', () => {
    expect(policyForPath('POST', '/api/v1/auth/login')?.name).toBe('auth');
    expect(policyForPath('GET', '/api/v1/auth/register')?.name).toBe('auth');
    expect(policyForPath('GET', '/api/v1/freeswitch/directory')?.name).toBe('runtime');
    expect(policyForPath('POST', '/api/v1/runtime/ivr/sessions')?.name).toBe('runtime');
    expect(policyForPath('POST', '/api/v1/call-events')?.name).toBe('runtime');
    expect(policyForPath('POST', '/api/v1/runtime/outbound')?.name).toBe('outbound');
    expect(policyForPath('POST', '/api/v1/webhooks/')?.name).toBe('webhook');
  });

  it('applies api fallback to authenticated DB-backed routes', () => {
    expect(policyForPath('GET', '/api/v1/sip-trunks')?.name).toBe('api');
    expect(policyForPath('POST', '/api/v1/sip-trunks')?.name).toBe('api');
    expect(policyForPath('GET', '/api/v1/extensions')?.name).toBe('api');
    expect(policyForPath('GET', '/api/v1/recordings')?.name).toBe('api');
    expect(policyForPath('GET', '/api/v1/platform/tenants')?.name).toBe('api');
    expect(policyForPath('GET', '/api/v1/platform/runtime/health')?.name).toBe('api');
    expect(policyForPath('GET', '/api/v1/ivr-flows')?.name).toBe('api');
    expect(policyForPath('PUT', '/api/v1/inbound-routes/abc-123')?.name).toBe('api');
  });

  it('applies scrape policy to /metrics', () => {
    expect(policyForPath('GET', '/metrics')?.name).toBe('scrape');
  });

  it('returns null for non-API paths', () => {
    expect(policyForPath('GET', '/health')).toBeNull();
    expect(policyForPath('GET', '/')).toBeNull();
    expect(policyForPath('GET', '/docs')).toBeNull();
  });

  it('strips query strings before matching', () => {
    expect(policyForPath('GET', '/api/v1/sip-trunks?page=2')?.name).toBe('api');
    expect(policyForPath('POST', '/api/v1/auth/login?redirect=home')?.name).toBe('auth');
  });

  it('classifies call-events internal ingest as runtime', () => {
    expect(policyForPath('POST', '/api/v1/call-events/internal/ingest')?.name).toBe('runtime');
  });

  it('classifies fraud endpoints as api (not runtime)', () => {
    expect(policyForPath('GET', '/api/v1/fraud/outbound-policy')?.name).toBe('api');
    expect(policyForPath('POST', '/api/v1/fraud/outbound-policy')?.name).toBe('api');
  });

  it('classifies platform admin endpoints as api', () => {
    expect(policyForPath('GET', '/api/v1/platform/nodes')?.name).toBe('api');
    expect(policyForPath('POST', '/api/v1/platform/nodes')?.name).toBe('api');
  });
});

describe('evaluateRateLimitTopology', () => {
  it('single-instance production with explicit limits has no failures', () => {
    const findings = evaluateRateLimitTopology(singleInstanceProduction);
    const failures = findings.filter((f) => f.level === 'fail');
    expect(failures).toHaveLength(0);
  });

  it('multi-instance production without external enforcer fails', () => {
    const findings = evaluateRateLimitTopology(multiInstanceUnsafe);
    const failures = findings.filter((f) => f.level === 'fail');
    expect(failures).toHaveLength(1);
    expect(failures[0]?.name).toBe('RATE_LIMIT_EXTERNAL_ENFORCED');
  });

  it('multi-instance production with external enforcer passes', () => {
    const findings = evaluateRateLimitTopology(multiInstanceExternal);
    const failures = findings.filter((f) => f.level === 'fail');
    expect(failures).toHaveLength(0);
  });

  it('multi-instance production with gateway enforcer passes', () => {
    const findings = evaluateRateLimitTopology(multiInstanceGateway);
    const failures = findings.filter((f) => f.level === 'fail');
    expect(failures).toHaveLength(0);
  });

  it('development environment multi-instance is not blocked', () => {
    const findings = evaluateRateLimitTopology({
      ...multiInstanceUnsafe,
      appEnv: 'development',
    });
    const failures = findings.filter((f) => f.level === 'fail');
    expect(failures).toHaveLength(0);
  });

  it('single-instance with MANAGECALLAI_INSTANCE_COUNT=1 never fails topology', () => {
    // The in-process limiter is safe for single-instance; no external enforcer needed.
    const findings = evaluateRateLimitTopology({ ...multiInstanceUnsafe, instanceCount: 1 });
    const failures = findings.filter((f) => f.level === 'fail');
    expect(failures).toHaveLength(0);
  });

  it('warns when explicit rate limits are missing', () => {
    const findings = evaluateRateLimitTopology({ ...singleInstanceProduction, explicitRateLimits: false });
    const warnings = findings.filter((f) => f.level === 'warn' && f.name === 'RATE_LIMIT_*');
    expect(warnings).toHaveLength(1);
  });

  it('warns when explicit window is missing in production', () => {
    const findings = evaluateRateLimitTopology({ ...singleInstanceProduction, explicitWindow: false });
    const warnings = findings.filter((f) => f.level === 'warn' && f.name === 'RATE_LIMIT_WINDOW_MS');
    expect(warnings).toHaveLength(1);
  });

  it('does not warn about window in non-production', () => {
    const findings = evaluateRateLimitTopology({
      ...singleInstanceProduction,
      appEnv: 'development',
      explicitWindow: false,
    });
    expect(findings.some((f) => f.name === 'RATE_LIMIT_WINDOW_MS')).toBe(false);
  });

  it('warns when external enforcer is set but store is not named', () => {
    const findings = evaluateRateLimitTopology({ ...multiInstanceExternal, storeNamed: false });
    const warnings = findings.filter((f) => f.level === 'warn' && f.name === 'RATE_LIMIT_STORE');
    expect(warnings).toHaveLength(1);
  });

  it('does not warn about missing store when single-instance', () => {
    const findings = evaluateRateLimitTopology({
      ...singleInstanceProduction,
      externalEnforced: true,
      storeNamed: false,
    });
    expect(findings.some((f) => f.name === 'RATE_LIMIT_STORE')).toBe(false);
  });

  it('no findings for a fully-configured multi-instance production deployment', () => {
    const findings = evaluateRateLimitTopology(multiInstanceExternal);
    expect(findings).toHaveLength(0);
  });
});
