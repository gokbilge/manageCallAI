import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppLayout } from './layout';

vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: () => ({
    session: {
      token: 'tok',
      claims: { sub: 'u1', tenant_id: 't1', email: 'u@example.com', role: 'tenant_admin' },
      tenantName: 'Acme',
      tenantSlug: 'acme',
      workspaces: ['tenant'],
    },
    signOut: vi.fn(),
    isAuthenticated: true,
  }),
}));

vi.mock('@/components/layout/app-sidebar', () => ({
  AppSidebar: ({ workspace }: { workspace: string; pathname: string }) => (
    <nav data-testid="sidebar" data-workspace={workspace} />
  ),
}));

vi.mock('@/components/layout/top-bar', () => ({
  TopBar: ({ workspace }: { workspace: string }) => (
    <header data-testid="topbar" data-workspace={workspace} />
  ),
}));

vi.mock('@/components/layout/inspector-panel', () => ({
  InspectorPanel: ({ workspace }: { workspace: string }) => (
    <aside data-testid="inspector" data-workspace={workspace} />
  ),
}));

function renderLayout(path = '/tenant/extensions') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppLayout />
    </MemoryRouter>,
  );
}

describe('AppLayout', () => {
  it('renders sidebar, topbar, and inspector panel', () => {
    renderLayout('/tenant/extensions');
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('topbar')).toBeInTheDocument();
    expect(screen.getByTestId('inspector')).toBeInTheDocument();
  });

  it('passes "tenant" workspace to all layout children for /tenant/* paths', () => {
    renderLayout('/tenant/ivr-flows');
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-workspace', 'tenant');
    expect(screen.getByTestId('topbar')).toHaveAttribute('data-workspace', 'tenant');
    expect(screen.getByTestId('inspector')).toHaveAttribute('data-workspace', 'tenant');
  });

  it('passes "platform" workspace to all layout children for /platform/* paths', () => {
    renderLayout('/platform/tenants');
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-workspace', 'platform');
    expect(screen.getByTestId('topbar')).toHaveAttribute('data-workspace', 'platform');
    expect(screen.getByTestId('inspector')).toHaveAttribute('data-workspace', 'platform');
  });

  it('defaults to "tenant" workspace for unknown paths', () => {
    renderLayout('/unknown/path');
    expect(screen.getByTestId('sidebar')).toHaveAttribute('data-workspace', 'tenant');
  });

  it('renders an Outlet slot (main element present)', () => {
    const { container } = renderLayout('/tenant/extensions');
    const main = container.querySelector('main');
    expect(main).toBeInTheDocument();
  });
});
