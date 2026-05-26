import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ExtensionsPage } from './extensions-page';
import { renderWithProviders } from '@/test/render';
import { apiRequest } from '@/lib/api/client';

vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: () => ({
    session: {
      token: 'token',
      claims: {
        tenant_id: 'tenant-1',
      },
    },
  }),
}));

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return {
    ...actual,
    apiRequest: vi.fn(),
  };
});

describe('ExtensionsPage', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  it('renders loading then empty state', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [] });

    renderWithProviders(<ExtensionsPage />);

    expect(screen.getByText('Loading extensions...')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('No extensions yet')).toBeInTheDocument();
    });
  });

  it('renders extension rows from API data', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: [
        {
          id: 'ext-1',
          tenant_id: 'tenant-1',
          extension_number: '200',
          display_name: 'Reception',
          status: 'active',
          sip_username: '200',
          default_destination_type: null,
          default_destination_id: null,
          created_at: '2026-05-27T00:00:00.000Z',
          updated_at: '2026-05-27T00:00:00.000Z',
        },
      ],
    });

    renderWithProviders(<ExtensionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Reception')).toBeInTheDocument();
      expect(screen.getByText('Not configured')).toBeInTheDocument();
    });
  });
});
