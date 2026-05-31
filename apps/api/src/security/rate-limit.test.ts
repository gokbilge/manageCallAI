import { describe, expect, it } from 'vitest';
import { InMemoryRateLimiter, policyForPath } from './rate-limit.js';

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
});
