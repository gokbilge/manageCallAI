import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { PlatformTenantsPage } from './platform-tenants-page';
import { ApiError } from '@/lib/api/client';

vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: () => ({ session: { token: 'tok', claims: { role: 'platform_admin' } } }),
}));
vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiRequest: vi.fn() };
});
import { apiRequest } from '@/lib/api/client';

afterEach(() => vi.clearAllMocks());

const baseTenant = { id: 't1', name: 'Acme', slug: 'acme', directory_domain: 'acme.local', status: 'active', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };

describe('PlatformTenantsPage', () => {

  it('renders page title', () => {
    vi.mocked(apiRequest).mockImplementation(() => new Promise(() => {}));
    renderWithProviders(<PlatformTenantsPage />);
    expect(screen.getByText('Tenants')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(apiRequest).mockImplementation(() => new Promise(() => {}));
    renderWithProviders(<PlatformTenantsPage />);
    expect(screen.getByText(/Loading tenant list/i)).toBeInTheDocument();
  });

  it('renders tenants table after load', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [baseTenant] });
    renderWithProviders(<PlatformTenantsPage />);
    await waitFor(() => {
      expect(screen.getByText('Acme')).toBeInTheDocument();
      expect(screen.getByText('acme')).toBeInTheDocument();
    });
  });

  it('shows empty state when no tenants', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [] });
    renderWithProviders(<PlatformTenantsPage />);
    await waitFor(() => {
      expect(screen.getByText(/No tenants/i)).toBeInTheDocument();
    });
  });

  it('shows access-required message for 403', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new ApiError('Forbidden', 403));
    renderWithProviders(<PlatformTenantsPage />);
    await waitFor(() => {
      expect(screen.getByText(/Platform access required/i)).toBeInTheDocument();
    });
  });

  it('shows generic error for non-403 failures', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('Internal error'));
    renderWithProviders(<PlatformTenantsPage />);
    await waitFor(() => {
      expect(document.body.textContent).toContain('Could not load tenants');
    }, { timeout: 5000 });
  });
});
