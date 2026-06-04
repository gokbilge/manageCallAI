import { fireEvent, screen, waitFor } from '@testing-library/react';
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
      expect(screen.getByText(/No calls matched the current filters/i)).toBeInTheDocument();
    });
  });

  it('renders call summary rows and selected call detail', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: [
        {
          id: 'evt-1',
          tenant_id: 'tenant-1',
          call_id: 'call-1',
          event_type: 'outbound_call_dispatched',
          event_time: '2026-05-27T00:00:00.000Z',
          source: 'freeswitch-agent',
          payload: { direction: 'outbound', to_number: '+14155550100', from_number: '1001' },
          ingested_at: '2026-05-27T00:00:01.000Z',
        },
        {
          id: 'evt-2',
          tenant_id: 'tenant-1',
          call_id: 'call-1',
          event_type: 'outbound_call_failed',
          event_time: '2026-05-27T00:00:03.000Z',
          source: 'freeswitch-agent',
          payload: { failure_reason: 'busy' },
          ingested_at: '2026-05-27T00:00:04.000Z',
        },
      ],
    });

    renderWithProviders(<CallsPage />);

    await waitFor(() => {
      expect(screen.getByText('+14155550100')).toBeInTheDocument();
    });
    expect(screen.getAllByText(/failed: busy/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Call call-1/i)).toBeInTheDocument();
    expect(screen.getAllByText(/outbound_call_failed/i).length).toBeGreaterThan(0);
  });

  it('filters call summaries by outcome', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: [
        {
          id: 'evt-1',
          tenant_id: 'tenant-1',
          call_id: 'call-active',
          event_type: 'channel_create',
          event_time: '2026-05-27T00:00:00.000Z',
          source: 'freeswitch-agent',
          payload: { direction: 'inbound', from_number: '+14155550101' },
          ingested_at: '2026-05-27T00:00:01.000Z',
        },
        {
          id: 'evt-2',
          tenant_id: 'tenant-1',
          call_id: 'call-failed',
          event_type: 'outbound_call_failed',
          event_time: '2026-05-27T00:01:00.000Z',
          source: 'freeswitch-agent',
          payload: { direction: 'outbound', to_number: '+14155550102', failure_reason: 'rejected' },
          ingested_at: '2026-05-27T00:01:01.000Z',
        },
      ],
    });

    renderWithProviders(<CallsPage />);

    await waitFor(() => {
      expect(screen.getByText('+14155550101')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Outcome filter'), { target: { value: 'failed' } });

    await waitFor(() => {
      expect(screen.queryByText('+14155550101')).not.toBeInTheDocument();
    });
    expect(screen.getAllByText('+14155550102').length).toBeGreaterThan(0);
  });
});
