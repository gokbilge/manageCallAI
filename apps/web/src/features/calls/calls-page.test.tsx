import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CallsPage } from './calls-page';
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

describe('CallsPage', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  it('renders empty state when no events are returned', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [] });

    renderWithProviders(<CallsPage />);

    expect(screen.getByText('Loading call events...')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/No call events yet/i)).toBeInTheDocument();
    });
  });

  it('renders event rows when data is returned', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: [
        {
          id: 'evt-1',
          tenant_id: 'tenant-1',
          call_id: 'call-1',
          event_type: 'channel_create',
          event_time: '2026-05-27T00:00:00.000Z',
          source: 'freeswitch-agent',
          payload: { step: 'created' },
          ingested_at: '2026-05-27T00:00:01.000Z',
        },
      ],
    });

    renderWithProviders(<CallsPage />);

    await waitFor(() => {
      expect(screen.getByText(/channel_create on call/i)).toBeInTheDocument();
      expect(screen.getByText(/freeswitch-agent/i)).toBeInTheDocument();
    });
  });
});
