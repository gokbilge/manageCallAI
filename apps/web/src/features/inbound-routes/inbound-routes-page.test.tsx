import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { InboundRoutesPage } from './inbound-routes-page';
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

function mockBothQueries(routes: unknown[], extensions: unknown[] = []) {
  vi.mocked(apiRequest).mockImplementation(async (path: string) => {
    if (String(path).includes('inbound-routes')) return { data: routes };
    return { data: extensions };
  });
}

describe('InboundRoutesPage', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  it('renders loading then empty state when no routes exist', async () => {
    mockBothQueries([]);

    renderWithProviders(<InboundRoutesPage />);

    expect(screen.getByText('Loading routes...')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('No inbound routes yet')).toBeInTheDocument();
    });
  });

  it('renders route rows from API data', async () => {
    mockBothQueries([
      {
        id: 'route-1',
        name: 'Main line',
        match_type: 'did',
        match_value: '+905551234567',
        target_type: 'extension',
        target_id: 'ext-1',
        status: 'active',
        draft_version_id: null,
        active_version_id: null,
        created_at: '2026-05-28T00:00:00.000Z',
        updated_at: '2026-05-28T00:00:00.000Z',
      },
    ]);

    renderWithProviders(<InboundRoutesPage />);

    await waitFor(() => {
      expect(screen.getByText('Main line')).toBeInTheDocument();
      expect(screen.getByText('+905551234567')).toBeInTheDocument();
    });
  });

  it('renders error state when routes API call fails', async () => {
    // ApiError(401) triggers noRetryOnAuthError → no retry → error state shown immediately
    vi.mocked(apiRequest).mockRejectedValue(new ApiError('Unauthorized', 401));

    renderWithProviders(<InboundRoutesPage />);

    await waitFor(() => {
      expect(screen.getByText('Could not load inbound routes')).toBeInTheDocument();
    });
  });

  it('shows no active extensions warning when extension list is empty', async () => {
    mockBothQueries([], []); // empty routes, empty extensions

    renderWithProviders(<InboundRoutesPage />);

    await waitFor(() => {
      expect(screen.getByText(/No active extensions/i)).toBeInTheDocument();
    });
  });
});
