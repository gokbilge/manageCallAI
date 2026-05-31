import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSession, decodeJwtClaims, persistSession, readStoredSession } from './session';

function token(payload: Record<string, unknown>): string {
  const encoded = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `header.${encoded}.signature`;
}

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('session storage', () => {
  it('decodes required JWT claims and preserves role', () => {
    const claims = decodeJwtClaims(token({
      sub: 'user-1',
      tenant_id: 'tenant-1',
      email: 'operator@example.com',
      role: 'tenant_operator',
    }));

    expect(claims).toEqual({
      sub: 'user-1',
      tenant_id: 'tenant-1',
      email: 'operator@example.com',
      role: 'tenant_operator',
    });
  });

  it('rejects malformed tokens and tokens missing required claims', () => {
    expect(() => decodeJwtClaims('not-a-jwt')).toThrow('Invalid token');
    expect(() => decodeJwtClaims(token({ sub: 'user-1', tenant_id: 'tenant-1' }))).toThrow('Invalid token claims');
  });

  it('creates platform and tenant workspaces for platform admins only', () => {
    const platform = createSession({
      token: token({ sub: 'user-1', tenant_id: 'tenant-1', email: 'admin@example.com', role: 'platform_admin' }),
    });
    const tenant = createSession({
      token: token({ sub: 'user-2', tenant_id: 'tenant-1', email: 'owner@example.com', role: 'tenant_admin' }),
    });

    expect(platform.workspaces).toEqual(['tenant', 'platform']);
    expect(tenant.workspaces).toEqual(['tenant']);
  });

  it('persists, reloads, and clears active sessions', () => {
    const session = createSession({
      token: token({ sub: 'user-1', tenant_id: 'tenant-1', email: 'owner@example.com', role: 'tenant_admin' }),
      tenantSlug: 'acme',
      tenantName: 'Acme',
      displayName: 'Owner',
    });

    persistSession(session);
    expect(readStoredSession()).toMatchObject({
      token: session.token,
      claims: session.claims,
      tenantSlug: 'acme',
      tenantName: 'Acme',
      displayName: 'Owner',
    });

    persistSession(null);
    expect(readStoredSession()).toBeNull();
  });

  it('removes expired stored sessions', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    const expired = createSession({
      token: token({
        sub: 'user-1',
        tenant_id: 'tenant-1',
        email: 'owner@example.com',
        role: 'tenant_admin',
        exp: 1_700_000_000,
      }),
    });

    persistSession(expired);

    expect(readStoredSession()).toBeNull();
    expect(window.localStorage.getItem('managecallai.session')).toBeNull();
  });
});
