import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, Navigate } from 'react-router-dom';
import { AuthContext } from '@/lib/auth/auth-context';
import { RequireCapability } from '@/lib/auth/require-capability';
import { RequireSession } from '@/lib/auth/require-session';
import { CAPABILITIES } from '@/lib/permissions/capabilities';
import { getWorkspaceFromPath } from '@/lib/routes/workspace';
import type { SessionState } from '@/lib/auth/session';
import type { ContextType } from 'react';

// ── Workspace utility ─────────────────────────────────────────────────────────

describe('getWorkspaceFromPath', () => {
  it('returns "platform" for /platform routes', () => {
    expect(getWorkspaceFromPath('/platform')).toBe('platform');
    expect(getWorkspaceFromPath('/platform/tenants')).toBe('platform');
    expect(getWorkspaceFromPath('/platform/runtime')).toBe('platform');
  });

  it('returns "tenant" for /tenant routes', () => {
    expect(getWorkspaceFromPath('/tenant/extensions')).toBe('tenant');
    expect(getWorkspaceFromPath('/tenant/ivr-flows')).toBe('tenant');
    expect(getWorkspaceFromPath('/tenant/calls')).toBe('tenant');
  });

  it('returns "tenant" for root and unknown paths', () => {
    expect(getWorkspaceFromPath('/')).toBe('tenant');
    expect(getWorkspaceFromPath('/auth')).toBe('tenant');
    expect(getWorkspaceFromPath('/unknown')).toBe('tenant');
  });
});

// ── Route guards: session + capability chain ──────────────────────────────────

function makeSession(role: SessionState['claims']['role']): SessionState {
  return {
    token: 'tok',
    claims: { sub: 'u1', tenant_id: 't1', email: 'u@example.com', role },
    workspaces: role === 'platform_admin' ? ['tenant', 'platform'] : ['tenant'],
  };
}

function renderGuardedRoute(
  authCtx: ContextType<typeof AuthContext>,
  path = '/protected',
  capability = CAPABILITIES.TENANT_IVR_FLOWS_PUBLISH,
) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={authCtx}>
        <Routes>
          <Route element={<RequireSession />}>
            <Route
              element={<RequireCapability capability={capability} redirectTo="/denied" />}
            >
              <Route path="/protected" element={<div>Protected page</div>} />
            </Route>
          </Route>
          <Route path="/auth" element={<div>Auth page</div>} />
          <Route path="/denied" element={<div>Access denied</div>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('route guards', () => {
  const noAuth: ContextType<typeof AuthContext> = {
    session: null,
    isAuthenticated: false,
    signIn: () => undefined,
    signOut: () => undefined,
  };

  const withAuth = (role: SessionState['claims']['role']): ContextType<typeof AuthContext> => ({
    session: makeSession(role),
    isAuthenticated: true,
    signIn: () => undefined,
    signOut: () => undefined,
  });

  it('unauthenticated user is redirected to /auth', () => {
    renderGuardedRoute(noAuth);
    expect(screen.getByText('Auth page')).toBeInTheDocument();
  });

  it('tenant_admin with publish capability sees protected page', () => {
    renderGuardedRoute(withAuth('tenant_admin'));
    expect(screen.getByText('Protected page')).toBeInTheDocument();
  });

  it('tenant_operator without publish capability is redirected to /denied', () => {
    renderGuardedRoute(withAuth('tenant_operator'));
    expect(screen.getByText('Access denied')).toBeInTheDocument();
  });

  it('tenant_viewer without publish capability is redirected to /denied', () => {
    renderGuardedRoute(withAuth('tenant_viewer'));
    expect(screen.getByText('Access denied')).toBeInTheDocument();
  });

  it('platform_admin inherits full tenant capabilities', () => {
    renderGuardedRoute(withAuth('platform_admin'));
    expect(screen.getByText('Protected page')).toBeInTheDocument();
  });

  it('tenant_viewer can reach view-only routes', () => {
    renderGuardedRoute(withAuth('tenant_viewer'), '/protected', CAPABILITIES.TENANT_IVR_FLOWS_VIEW);
    expect(screen.getByText('Protected page')).toBeInTheDocument();
  });

  it('tenant_operator can reach operator-level routes', () => {
    renderGuardedRoute(withAuth('tenant_operator'), '/protected', CAPABILITIES.TENANT_IVR_FLOWS_CREATE);
    expect(screen.getByText('Protected page')).toBeInTheDocument();
  });
});

// ── Root redirect ─────────────────────────────────────────────────────────────

describe('root route redirect', () => {
  it('/ redirects to /tenant/extensions', () => {
    const authCtx: ContextType<typeof AuthContext> = {
      session: makeSession('tenant_admin'),
      isAuthenticated: true,
      signIn: () => undefined,
      signOut: () => undefined,
    };

    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthContext.Provider value={authCtx}>
          <Routes>
            <Route index element={<Navigate to="/tenant/extensions" replace />} />
            <Route path="/tenant/extensions" element={<div>Extensions page</div>} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Extensions page')).toBeInTheDocument();
  });
});

// ── Platform capability guard ─────────────────────────────────────────────────

describe('platform route guard', () => {
  function renderPlatformRoute(role: SessionState['claims']['role']) {
    const authCtx: ContextType<typeof AuthContext> = {
      session: makeSession(role),
      isAuthenticated: true,
      signIn: () => undefined,
      signOut: () => undefined,
    };
    return render(
      <MemoryRouter initialEntries={['/platform']}>
        <AuthContext.Provider value={authCtx}>
          <Routes>
            <Route element={<RequireSession />}>
              <Route
                element={(
                  <RequireCapability
                    capability={CAPABILITIES.PLATFORM_TENANTS_VIEW}
                    redirectTo="/tenant/extensions"
                  />
                )}
              >
                <Route path="/platform" element={<div>Platform home</div>} />
              </Route>
            </Route>
            <Route path="/tenant/extensions" element={<div>Extensions page</div>} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>,
    );
  }

  it('platform_admin can access platform routes', () => {
    renderPlatformRoute('platform_admin');
    expect(screen.getByText('Platform home')).toBeInTheDocument();
  });

  it('tenant_admin is redirected away from platform routes', () => {
    renderPlatformRoute('tenant_admin');
    expect(screen.getByText('Extensions page')).toBeInTheDocument();
  });

  it('tenant_operator is redirected away from platform routes', () => {
    renderPlatformRoute('tenant_operator');
    expect(screen.getByText('Extensions page')).toBeInTheDocument();
  });
});
