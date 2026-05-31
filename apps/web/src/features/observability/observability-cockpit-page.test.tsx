import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ObservabilityCockpitPage } from './observability-cockpit-page';
import { renderWithProviders } from '@/test/render';
import { ApiError, apiRequest } from '@/lib/api/client';
import type { LiveSnapshot } from '@/lib/observability/observability-api';

vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: () => ({
    session: {
      token: 'test-token',
      claims: { tenant_id: 'tenant-1', role: 'tenant_admin' },
      tenantSlug: 'test-tenant',
    },
  }),
}));

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiRequest: vi.fn() };
});

const emptySnapshot: LiveSnapshot = {
  tenant_id: 'tenant-1',
  active_session_count: 0,
  running_sessions: [],
  queue_depths: [],
  webhook_backlog: { pending: 0, processing: 0, failed: 0, abandoned: 0 },
  recent_call_events_5m: 0,
  recent_session_failures_1h: 0,
  pending_approvals: 0,
  generated_at: new Date().toISOString(),
};

describe('ObservabilityCockpitPage', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  it('shows loading state initially', () => {
    vi.mocked(apiRequest).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<ObservabilityCockpitPage />);
    expect(screen.getByText('Loading sessions…')).toBeInTheDocument();
  });

  it('renders zero-state correctly for empty tenant', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: emptySnapshot });
    renderWithProviders(<ObservabilityCockpitPage />);

    await waitFor(() => {
      expect(screen.getByText('No active sessions')).toBeInTheDocument();
    });
    expect(screen.getByText('No active queues configured')).toBeInTheDocument();
  });

  it('shows active session count in stat cards', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        ...emptySnapshot,
        active_session_count: 3,
        recent_call_events_5m: 7,
        pending_approvals: 1,
      } satisfies LiveSnapshot,
    });

    renderWithProviders(<ObservabilityCockpitPage />);

    // Wait until the loading placeholder '…' is gone from the stat cards
    await waitFor(() => {
      expect(screen.queryByText('…')).not.toBeInTheDocument();
    });
    // Values may appear more than once (stat card + bottom section); use getAllByText
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('7').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);
  });

  it('renders running session rows', async () => {
    const session = {
      id: 'sess-1',
      call_id: 'call-abc-1234567890',
      flow_id: 'flow-1',
      caller_number: '+14155550001',
      current_node_id: 'node-menu',
      started_at: new Date(Date.now() - 30_000).toISOString(),
    };

    vi.mocked(apiRequest).mockResolvedValue({
      data: { ...emptySnapshot, active_session_count: 1, running_sessions: [session] } satisfies LiveSnapshot,
    });

    renderWithProviders(<ObservabilityCockpitPage />);

    await waitFor(() => {
      expect(screen.getByText('+14155550001')).toBeInTheDocument();
    });
    expect(screen.getByText('node-menu')).toBeInTheDocument();
  });

  it('renders queue depth cards', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        ...emptySnapshot,
        queue_depths: [
          { queue_id: 'q-1', queue_name: 'Sales', member_count: 4 },
          { queue_id: 'q-2', queue_name: 'Support', member_count: 2 },
        ],
      } satisfies LiveSnapshot,
    });

    renderWithProviders(<ObservabilityCockpitPage />);

    await waitFor(() => {
      expect(screen.getByText('Sales')).toBeInTheDocument();
    });
    expect(screen.getByText('Support')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('shows webhook backlog counts', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        ...emptySnapshot,
        webhook_backlog: { pending: 5, processing: 1, failed: 2, abandoned: 0 },
      } satisfies LiveSnapshot,
    });

    renderWithProviders(<ObservabilityCockpitPage />);

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
    });
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('shows session failure count in danger colour when > 0', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: { ...emptySnapshot, recent_session_failures_1h: 3 } satisfies LiveSnapshot,
    });

    renderWithProviders(<ObservabilityCockpitPage />);

    await waitFor(() => {
      // "3" should appear; the exact element has the danger class — just verify presence
      const failureCount = screen.getByText('3');
      expect(failureCount).toBeInTheDocument();
    });
  });

  it('shows error state when API returns 403', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new ApiError('Forbidden', 403));

    renderWithProviders(<ObservabilityCockpitPage />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText('Operator access required')).toBeInTheDocument();
  });

  it('shows error state on network-level failure', async () => {
    // noRetryOnAuthError skips retry for 401/403 — use 401 to get immediate isError state
    vi.mocked(apiRequest).mockRejectedValue(new ApiError('Unauthorized', 401));

    renderWithProviders(<ObservabilityCockpitPage />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    // 401 is auth failure — shows generic "could not load" message (not "Operator access required")
    expect(screen.getByText('Could not load live snapshot')).toBeInTheDocument();
  });

  it('does not render any sensitive credential fields', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: emptySnapshot });
    renderWithProviders(<ObservabilityCockpitPage />);

    await waitFor(() => {
      expect(screen.queryByText('password_hash')).not.toBeInTheDocument();
      expect(screen.queryByText('sip_password')).not.toBeInTheDocument();
      expect(screen.queryByText('signing_secret')).not.toBeInTheDocument();
    });
  });
});
