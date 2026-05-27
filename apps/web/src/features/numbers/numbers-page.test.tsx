import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NumbersPage } from './numbers-page';
import { renderWithProviders } from '@/test/render';
import { ApiError, apiRequest } from '@/lib/api/client';

vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: () => ({
    session: {
      token: 'token',
      claims: { tenant_id: 'tenant-1' },
    },
  }),
}));

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiRequest: vi.fn() };
});

describe('NumbersPage', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  it('renders loading then empty state when no numbers exist', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [] });

    renderWithProviders(<NumbersPage />);

    expect(screen.getByText('Loading numbers...')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('No phone numbers yet')).toBeInTheDocument();
    });
  });

  it('renders number rows from API data', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: [
        {
          id: 'num-1',
          tenant_id: 'tenant-1',
          e164_number: '+905551234567',
          display_label: 'Main sales line',
          status: 'active',
          assigned_target_type: null,
          assigned_target_id: null,
          trunk_id: null,
          created_at: '2026-05-28T00:00:00.000Z',
          updated_at: '2026-05-28T00:00:00.000Z',
        },
      ],
    });

    renderWithProviders(<NumbersPage />);

    await waitFor(() => {
      expect(screen.getByText('+905551234567')).toBeInTheDocument();
      expect(screen.getByText('Main sales line')).toBeInTheDocument();
      expect(screen.getByText('Unassigned')).toBeInTheDocument();
    });
  });

  it('renders error state when API call fails', async () => {
    // ApiError(401) triggers noRetryOnAuthError → no retry → error state shown immediately
    vi.mocked(apiRequest).mockRejectedValue(new ApiError('Unauthorized', 401));

    renderWithProviders(<NumbersPage />);

    await waitFor(() => {
      expect(screen.getByText('Could not load phone numbers')).toBeInTheDocument();
    });
  });
});
