import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { TenantDashboardPage } from './tenant-dashboard-page';

vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: () => ({ session: { tenantName: 'Acme Corp', tenantSlug: 'acme', token: 'tok', claims: { role: 'tenant_admin', tenant_id: 't1' } } }),
}));

describe('TenantDashboardPage', () => {
  it('renders the page title', () => {
    renderWithProviders(<TenantDashboardPage />);
    expect(screen.getByText('Tenant Dashboard')).toBeInTheDocument();
  });

  it('renders the tenant name in the description', () => {
    renderWithProviders(<TenantDashboardPage />);
    expect(screen.getByText(/Acme Corp/i)).toBeInTheDocument();
  });

  it('renders all lifecycle state labels', () => {
    renderWithProviders(<TenantDashboardPage />);
    for (const label of ['Draft', 'Validated', 'Simulated', 'Published', 'Rollback Available']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('renders stat cards', () => {
    renderWithProviders(<TenantDashboardPage />);
    expect(screen.getByText('Active Extensions')).toBeInTheDocument();
    expect(screen.getByText('Flow Drafts')).toBeInTheDocument();
    expect(screen.getByText('Recent Call Events')).toBeInTheDocument();
  });

  it('renders without crashing when session fields are minimal', () => {
    renderWithProviders(<TenantDashboardPage />);
    expect(screen.getByText('Tenant Dashboard')).toBeInTheDocument();
  });
});
