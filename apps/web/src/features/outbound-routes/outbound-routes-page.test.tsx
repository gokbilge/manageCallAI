import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { OutboundRoutesPage } from './outbound-routes-page';
import { apiRequest } from '@/lib/api/client';

vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: () => ({
    session: { token: 'test-token', claims: { tenant_id: 'tenant-1' } },
  }),
}));

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiRequest: vi.fn() };
});

const mockRoutes = [
  {
    id: 'r-1',
    name: 'International',
    status: 'active',
    match_prefix: '+',
    priority: 100,
    sip_trunk_id: '00000000-0000-0000-0000-000000000001',
    fallback_sip_trunk_id: null,
    max_calls_per_minute: null,
    created_at: '2026-01-01T00:00:00Z',
  },
];

describe('OutboundRoutesPage', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockResolvedValue({ data: mockRoutes });
  });

  it('renders the page heading', async () => {
    renderWithProviders(<OutboundRoutesPage />);
    expect(screen.getByText('Outbound Routes')).toBeInTheDocument();
  });

  it('shows loaded routes', async () => {
    renderWithProviders(<OutboundRoutesPage />);
    await waitFor(() => {
      expect(screen.getByText('International')).toBeInTheDocument();
    });
    expect(screen.getByText('+')).toBeInTheDocument();
  });

  it('shows empty state when no routes', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [] });
    renderWithProviders(<OutboundRoutesPage />);
    await waitFor(() => {
      expect(screen.getByText('No outbound routes yet')).toBeInTheDocument();
    });
  });

  it('shows error state on fetch failure', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('Server error'));
    renderWithProviders(<OutboundRoutesPage />);
    await waitFor(() => {
      expect(screen.getByText('Could not load outbound routes')).toBeInTheDocument();
    });
  });
});
