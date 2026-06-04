import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { AppSidebar } from './app-sidebar';

vi.mock('@/lib/auth/use-auth', () => ({ useAuth: vi.fn() }));
import { useAuth } from '@/lib/auth/use-auth';

function makeSession(role: string) {
  return { token: 'tok', claims: { role, tenant_id: 't1', sub: 'u', email: 'u@e.com' } };
}

describe('AppSidebar', () => {
  it('renders tenant workspace title', () => {
    vi.mocked(useAuth).mockReturnValue({ session: makeSession('tenant_admin') } as never);
    renderWithProviders(<AppSidebar workspace="tenant" pathname="/tenant/extensions" />);
    expect(screen.getByText('Tenant Workspace')).toBeInTheDocument();
  });

  it('renders platform workspace title', () => {
    vi.mocked(useAuth).mockReturnValue({ session: makeSession('platform_admin') } as never);
    renderWithProviders(<AppSidebar workspace="platform" pathname="/platform" />);
    expect(screen.getByText('Platform Workspace')).toBeInTheDocument();
  });

  it('shows key tenant nav items for tenant_admin', () => {
    vi.mocked(useAuth).mockReturnValue({ session: makeSession('tenant_admin') } as never);
    renderWithProviders(<AppSidebar workspace="tenant" pathname="/tenant/extensions" />);
    expect(screen.getByText('Extensions')).toBeInTheDocument();
    expect(screen.getByText('IVR Flows')).toBeInTheDocument();
    expect(screen.getByText('Approvals')).toBeInTheDocument();
    expect(screen.getByText('Feature Codes')).toBeInTheDocument();
  });

  it('shows platform nav items for platform_admin', () => {
    vi.mocked(useAuth).mockReturnValue({ session: makeSession('platform_admin') } as never);
    renderWithProviders(<AppSidebar workspace="platform" pathname="/platform" />);
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Tenants')).toBeInTheDocument();
    expect(screen.getByText('Runtime')).toBeInTheDocument();
  });

  it('hides capability-gated items from tenant_viewer', () => {
    vi.mocked(useAuth).mockReturnValue({ session: makeSession('tenant_viewer') } as never);
    renderWithProviders(<AppSidebar workspace="tenant" pathname="/tenant/extensions" />);
    // Compliance admin cap required; viewer should not see it
    expect(screen.queryByText('Compliance')).not.toBeInTheDocument();
  });

  it('shows security alerts nav item for tenant_operator+', () => {
    vi.mocked(useAuth).mockReturnValue({ session: makeSession('tenant_operator') } as never);
    renderWithProviders(<AppSidebar workspace="tenant" pathname="/tenant/extensions" />);
    expect(screen.getByText('Security Alerts')).toBeInTheDocument();
  });

  it('renders runtime posture callout', () => {
    vi.mocked(useAuth).mockReturnValue({ session: makeSession('tenant_admin') } as never);
    renderWithProviders(<AppSidebar workspace="tenant" pathname="/tenant/extensions" />);
    expect(screen.getByText(/Runtime posture/i)).toBeInTheDocument();
  });
});
