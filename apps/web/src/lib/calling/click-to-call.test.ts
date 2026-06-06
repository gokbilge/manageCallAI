import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildCallHref } from './click-to-call';

vi.mock('@/lib/provisioning/sip-provisioning', () => ({
  getSipServer: vi.fn().mockReturnValue('pbx.example.com'),
}));

import { getSipServer } from '@/lib/provisioning/sip-provisioning';

describe('buildCallHref', () => {
  beforeEach(() => {
    vi.mocked(getSipServer).mockReturnValue('pbx.example.com');
  });

  it('returns sip URI for short internal extension', () => {
    const result = buildCallHref('101');
    expect(result).toEqual({ supported: true, href: 'sip:101@pbx.example.com', scheme: 'sip' });
  });

  it('returns sip URI for 6-digit extension', () => {
    const result = buildCallHref('200100');
    expect(result).toEqual({ supported: true, href: 'sip:200100@pbx.example.com', scheme: 'sip' });
  });

  it('returns tel URI for E.164 number', () => {
    const result = buildCallHref('+15551234567');
    expect(result).toEqual({ supported: true, href: 'tel:+15551234567', scheme: 'tel' });
  });

  it('returns tel URI for 10-digit NANP number', () => {
    const result = buildCallHref('5551234567');
    expect(result).toEqual({ supported: true, href: 'tel:5551234567', scheme: 'tel' });
  });

  it('returns no_sip_server when SIP domain is missing for internal extension', () => {
    vi.mocked(getSipServer).mockReturnValue('');
    const result = buildCallHref('101');
    expect(result).toEqual({ supported: false, reason: 'no_sip_server' });
  });

  it('returns no_number for empty string', () => {
    const result = buildCallHref('');
    expect(result).toEqual({ supported: false, reason: 'no_number' });
  });

  it('returns no_number for whitespace-only string', () => {
    const result = buildCallHref('   ');
    expect(result).toEqual({ supported: false, reason: 'no_number' });
  });

  it('still works for tel URI when SIP domain is missing', () => {
    vi.mocked(getSipServer).mockReturnValue('');
    const result = buildCallHref('+15551234567');
    expect(result).toEqual({ supported: true, href: 'tel:+15551234567', scheme: 'tel' });
  });
});
