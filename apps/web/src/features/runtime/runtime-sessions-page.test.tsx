import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RuntimeSessionsPage } from './runtime-sessions-page';
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

describe('RuntimeSessionsPage', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  it('shows loading then empty state when no sessions exist', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [] });

    renderWithProviders(<RuntimeSessionsPage />);

    expect(screen.getByText('Loading sessions...')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('No sessions yet')).toBeInTheDocument();
    });
  });

  it('renders session rows from API data', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: [
        {
          id: 's-1',
          call_id: 'call-abc-123',
          flow_id: 'flow-1',
          status: 'completed',
          current_node_id: 'node-hangup',
          caller_number: '+14155550001',
          created_at: '2026-05-28T01:00:00.000Z',
          completed_at: '2026-05-28T01:02:00.000Z',
        },
      ],
    });

    renderWithProviders(<RuntimeSessionsPage />);

    await waitFor(() => {
      expect(screen.getByText('call-abc-123')).toBeInTheDocument();
      expect(screen.getByText('+14155550001')).toBeInTheDocument();
      expect(screen.getByText('node-hangup')).toBeInTheDocument();
    });
  });

  it('shows error state when API call fails', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new ApiError('Forbidden', 403));

    renderWithProviders(<RuntimeSessionsPage />);

    await waitFor(() => {
      expect(screen.getByText('Could not load sessions')).toBeInTheDocument();
    });
  });
});
