import { describe, expect, it } from 'vitest';
import type { ContextType } from 'react';
import { screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render } from '@testing-library/react';
import { AuthContext } from './auth-context';
import { RequireCapability } from './require-capability';
import { RequireSession } from './require-session';
import { CAPABILITIES } from '@/lib/permissions/capabilities';
import type { SessionState } from './session';

function session(role: SessionState['claims']['role']): SessionState {
  return {
    token: 'token',
    claims: {
      sub: 'user-1',
      tenant_id: 'tenant-1',
      email: 'user@example.com',
      role,
    },
    workspaces: role === 'platform_admin' ? ['tenant', 'platform'] : ['tenant'],
  };
}

function renderWithAuth(value: ContextType<typeof AuthContext>, path = '/protected') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={value}>
        <Routes>
          <Route element={<RequireSession />}>
            <Route
              path="/protected"
              element={(
                <RequireCapability capability={CAPABILITIES.TENANT_IVR_FLOWS_PUBLISH} redirectTo="/denied" />
              )}
            >
              <Route index element={<div>Allowed publish</div>} />
            </Route>
          </Route>
          <Route path="/auth" element={<div>Login screen</div>} />
          <Route path="/denied" element={<div>Permission denied</div>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe('auth route guards', () => {
  it('redirects unauthenticated users to auth', () => {
    renderWithAuth({
      session: null,
      isAuthenticated: false,
      signIn: () => undefined,
      signOut: () => undefined,
    });

    expect(screen.getByText('Login screen')).toBeInTheDocument();
  });

  it('renders the protected outlet when the session has the capability', () => {
    renderWithAuth({
      session: session('tenant_admin'),
      isAuthenticated: true,
      signIn: () => undefined,
      signOut: () => undefined,
    });

    expect(screen.getByText('Allowed publish')).toBeInTheDocument();
  });

  it('redirects authenticated users without the capability', () => {
    renderWithAuth({
      session: session('tenant_operator'),
      isAuthenticated: true,
      signIn: () => undefined,
      signOut: () => undefined,
    });

    expect(screen.getByText('Permission denied')).toBeInTheDocument();
  });
});
