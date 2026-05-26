export type WorkspaceAccess = 'platform' | 'tenant';

export type SessionClaims = {
  sub: string;
  tenant_id: string;
  email: string;
};

export type SessionState = {
  token: string;
  claims: SessionClaims;
  tenantSlug?: string;
  tenantName?: string;
  displayName?: string;
  workspaces: WorkspaceAccess[];
};

const STORAGE_KEY = 'managecallai.session';

export function decodeJwtClaims(token: string): SessionClaims {
  const [, payload] = token.split('.');
  if (!payload) {
    throw new Error('Invalid token');
  }

  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const decoded = JSON.parse(atob(padded)) as Partial<SessionClaims>;
  if (!decoded.sub || !decoded.tenant_id || !decoded.email) {
    throw new Error('Invalid token claims');
  }

  return {
    sub: decoded.sub,
    tenant_id: decoded.tenant_id,
    email: decoded.email,
  };
}

export function createSession(input: {
  token: string;
  tenantSlug?: string;
  tenantName?: string;
  displayName?: string;
}): SessionState {
  return {
    token: input.token,
    claims: decodeJwtClaims(input.token),
    tenantSlug: input.tenantSlug,
    tenantName: input.tenantName,
    displayName: input.displayName,
    workspaces: ['tenant'],
  };
}

export function readStoredSession(): SessionState | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as SessionState;
    if (!parsed.token) {
      return null;
    }

    return {
      ...parsed,
      claims: decodeJwtClaims(parsed.token),
    };
  } catch {
    return null;
  }
}

export function persistSession(session: SessionState | null) {
  if (!session) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}
