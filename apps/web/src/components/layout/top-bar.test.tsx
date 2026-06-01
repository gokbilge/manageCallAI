import { screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { TopBar } from './top-bar';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (imp) => {
  const actual = await imp<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockSignOut = vi.fn();

vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '@/lib/auth/use-auth';

function makeSession(role = 'tenant_admin') {
  return {
    token: 'tok',
    tenantName: 'Acme',
    tenantSlug: 'acme',
    claims: { sub: 'u1', tenant_id: 't1', email: 'u@example.com', role },
    workspaces: ['tenant'],
  };
}

describe('TopBar', () => {
  it('renders brand name', () => {
    vi.mocked(useAuth).mockReturnValue({ session: makeSession(), isAuthenticated: true, signIn: vi.fn(), signOut: mockSignOut } as never);
    renderWithProviders(<TopBar workspace="tenant" />);
    expect(screen.getByText('manageCallAI')).toBeInTheDocument();
  });

  it('shows Platform workspace switch button for tenant workspace', () => {
    vi.mocked(useAuth).mockReturnValue({ session: makeSession(), isAuthenticated: true, signIn: vi.fn(), signOut: mockSignOut } as never);
    renderWithProviders(<TopBar workspace="tenant" />);
    expect(screen.getByText(/Platform workspace/i)).toBeInTheDocument();
  });

  it('shows Tenant workspace switch button for platform workspace', () => {
    vi.mocked(useAuth).mockReturnValue({ session: makeSession(), isAuthenticated: true, signIn: vi.fn(), signOut: mockSignOut } as never);
    renderWithProviders(<TopBar workspace="platform" />);
    expect(screen.getByText(/Acme workspace|Tenant workspace/i)).toBeInTheDocument();
  });

  it('shows sign out button when authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({ session: makeSession(), isAuthenticated: true, signIn: vi.fn(), signOut: mockSignOut } as never);
    renderWithProviders(<TopBar workspace="tenant" />);
    expect(screen.getByText('Sign out')).toBeInTheDocument();
  });

  it('does not show sign out button when unauthenticated', () => {
    vi.mocked(useAuth).mockReturnValue({ session: null, isAuthenticated: false, signIn: vi.fn(), signOut: mockSignOut } as never);
    renderWithProviders(<TopBar workspace="tenant" />);
    expect(screen.queryByText('Sign out')).not.toBeInTheDocument();
  });

  it('navigates to platform when switching from tenant workspace', () => {
    vi.mocked(useAuth).mockReturnValue({ session: makeSession(), isAuthenticated: true, signIn: vi.fn(), signOut: mockSignOut } as never);
    renderWithProviders(<TopBar workspace="tenant" />);
    fireEvent.click(screen.getByTitle(/Switch to Platform workspace/i));
    expect(mockNavigate).toHaveBeenCalledWith('/platform');
  });

  it('navigates to tenant extensions when switching from platform workspace', () => {
    vi.mocked(useAuth).mockReturnValue({ session: makeSession(), isAuthenticated: true, signIn: vi.fn(), signOut: mockSignOut } as never);
    renderWithProviders(<TopBar workspace="platform" />);
    const btn = screen.getByTitle(/Switch to.*workspace/i);
    fireEvent.click(btn);
    expect(mockNavigate).toHaveBeenCalledWith('/tenant/extensions');
  });

  it('calls signOut when sign out button is clicked', () => {
    vi.mocked(useAuth).mockReturnValue({ session: makeSession(), isAuthenticated: true, signIn: vi.fn(), signOut: mockSignOut } as never);
    renderWithProviders(<TopBar workspace="tenant" />);
    fireEvent.click(screen.getByText('Sign out'));
    expect(mockSignOut).toHaveBeenCalled();
  });
});
