import { describe, expect, it } from 'vitest';
import { redactSensitiveUrl } from './logger.js';

describe('redactSensitiveUrl', () => {
  it('redacts runtime token fallback query parameters', () => {
    expect(redactSensitiveUrl('/api/v1/freeswitch/directory?runtime_token=secret-token&domain=tenant.example'))
      .toBe('/api/v1/freeswitch/directory?runtime_token=%5BREDACTED%5D&domain=tenant.example');
  });

  it('redacts generic token and secret query parameters while keeping routing context', () => {
    expect(redactSensitiveUrl('/api/v1/runtime/ivr/sessions?access_token=abc&signing_secret=def&call_id=c1'))
      .toBe('/api/v1/runtime/ivr/sessions?access_token=%5BREDACTED%5D&signing_secret=%5BREDACTED%5D&call_id=c1');
  });

  it('leaves URLs without sensitive query parameters unchanged', () => {
    expect(redactSensitiveUrl('/api/v1/call-events?call_id=c1')).toBe('/api/v1/call-events?call_id=c1');
  });
});
