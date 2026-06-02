import { render, screen, act } from '@testing-library/react';
import { useContext } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthContext, AuthProvider } from './auth-context';

function buildToken(claims: Record<string, unknown>): string {
  const payload = btoa(JSON.stringify({ sub: 'u1', tenant_id: 't1', email: 'u@test.com', ...claims }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `eyJhbGciOiJIUzI1NiJ9.${payload}.sig`;
}

vi.mock('./session', () => ({
  readStoredSession: vi.fn(() => null),
  persistSession: vi.fn(),
  createSession: vi.fn((input: { token: string; tenantSlug?: string; tenantName?: string }) => ({
    token: input.token,
    claims: { sub: 'u1', tenant_id: 't1', email: 'u@test.com' },
    tenantSlug: input.tenantSlug,
    tenantName: input.tenantName,
    workspaces: ['tenant'],
  })),
}));

import { readStoredSession, persistSession, createSession } from './session';

const mockReadSession = vi.mocked(readStoredSession);
const mockPersist = vi.mocked(persistSession);
const mockCreate = vi.mocked(createSession);

// Consumer component that reads all context values
function Consumer() {
  const ctx = useContext(AuthContext);
  if (!ctx) return <div data-testid="no-ctx">no context</div>;
  return (
    <div>
      <div data-testid="authenticated">{String(ctx.isAuthenticated)}</div>
      <div data-testid="token">{ctx.session?.token ?? 'null'}</div>
      <button onClick={ctx.signOut} data-testid="sign-out">out</button>
      <button
        onClick={() =>
          ctx.signIn({ token: 'tok2', tenantSlug: 'acme', tenantName: 'Acme Corp' })
        }
        data-testid="sign-in"
      >
        in
      </button>
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockReadSession.mockReturnValue(null);
});

describe('AuthProvider', () => {
  it('renders children', () => {
    render(
      <AuthProvider>
        <span data-testid="child">hello</span>
      </AuthProvider>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('calls readStoredSession on mount', () => {
    render(<AuthProvider><Consumer /></AuthProvider>);
    expect(mockReadSession).toHaveBeenCalledTimes(1);
  });

  it('starts unauthenticated when no stored session', () => {
    render(<AuthProvider><Consumer /></AuthProvider>);
    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    expect(screen.getByTestId('token').textContent).toBe('null');
  });

  it('restores session from storage on mount', () => {
    const stored = {
      token: buildToken({}),
      claims: { sub: 'u1', tenant_id: 't1', email: 'u@test.com' },
      workspaces: ['tenant'] as const,
    };
    mockReadSession.mockReturnValue(stored as never);
    render(<AuthProvider><Consumer /></AuthProvider>);
    expect(screen.getByTestId('authenticated').textContent).toBe('true');
    expect(screen.getByTestId('token').textContent).toBe(stored.token);
  });

  it('signIn sets session and persists it', async () => {
    const newSession = {
      token: 'tok2',
      claims: { sub: 'u1', tenant_id: 't1', email: 'u@test.com' },
      tenantSlug: 'acme',
      tenantName: 'Acme Corp',
      workspaces: ['tenant'] as const,
    };
    mockCreate.mockReturnValue(newSession as never);

    render(<AuthProvider><Consumer /></AuthProvider>);
    expect(screen.getByTestId('authenticated').textContent).toBe('false');

    await act(async () => {
      screen.getByTestId('sign-in').click();
    });

    expect(mockCreate).toHaveBeenCalledWith({
      token: 'tok2',
      tenantSlug: 'acme',
      tenantName: 'Acme Corp',
    });
    expect(mockPersist).toHaveBeenCalledWith(newSession);
    expect(screen.getByTestId('authenticated').textContent).toBe('true');
    expect(screen.getByTestId('token').textContent).toBe('tok2');
  });

  it('signOut clears session and persists null', async () => {
    const stored = {
      token: 'tok1',
      claims: { sub: 'u1', tenant_id: 't1', email: 'u@test.com' },
      workspaces: ['tenant'] as const,
    };
    mockReadSession.mockReturnValue(stored as never);

    render(<AuthProvider><Consumer /></AuthProvider>);
    expect(screen.getByTestId('authenticated').textContent).toBe('true');

    await act(async () => {
      screen.getByTestId('sign-out').click();
    });

    expect(mockPersist).toHaveBeenCalledWith(null);
    expect(screen.getByTestId('authenticated').textContent).toBe('false');
    expect(screen.getByTestId('token').textContent).toBe('null');
  });

  it('managecallai:unauthorized event triggers signOut', async () => {
    const stored = {
      token: 'tok1',
      claims: { sub: 'u1', tenant_id: 't1', email: 'u@test.com' },
      workspaces: ['tenant'] as const,
    };
    mockReadSession.mockReturnValue(stored as never);

    render(<AuthProvider><Consumer /></AuthProvider>);
    expect(screen.getByTestId('authenticated').textContent).toBe('true');

    await act(async () => {
      window.dispatchEvent(new Event('managecallai:unauthorized'));
    });

    expect(mockPersist).toHaveBeenCalledWith(null);
    expect(screen.getByTestId('authenticated').textContent).toBe('false');
  });

  it('removes unauthorized listener on unmount', () => {
    const removeListener = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<AuthProvider><Consumer /></AuthProvider>);
    unmount();
    expect(removeListener).toHaveBeenCalledWith('managecallai:unauthorized', expect.any(Function));
    removeListener.mockRestore();
  });
});
