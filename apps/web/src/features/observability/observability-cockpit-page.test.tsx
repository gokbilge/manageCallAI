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
  freeswitch_nodes: { active: 0, total: 0 },
  generated_at: new Date().toISOString(),
};

function mockApi(overrides: {
  snapshot?: LiveSnapshot;
  gatewayStatus?: Array<{ trunk_id: string; trunk_name: string; node_id: string; state: string; queried_at: string }>;
  callEvents?: unknown[];
  error?: Error;
} = {}) {
  vi.mocked(apiRequest).mockImplementation(async (path: string) => {
    if (overrides.error) {
      throw overrides.error;
    }
    if (path === '/observability/snapshot') {
      return { data: overrides.snapshot ?? emptySnapshot };
    }
    if (path === '/runtime/gateway-status') {
      return { data: overrides.gatewayStatus ?? [] };
    }
    if (path === '/call-events') {
      return { data: overrides.callEvents ?? [] };
    }
    throw new Error(`Unexpected path ${path}`);
  });
}

describe('ObservabilityCockpitPage', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  it('shows loading state initially', () => {
    vi.mocked(apiRequest).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<ObservabilityCockpitPage />);
    expect(screen.getByText('Loading triage signals...')).toBeInTheDocument();
  });

  it('renders zero-state correctly for empty tenant', async () => {
    mockApi();
    renderWithProviders(<ObservabilityCockpitPage />);

    await waitFor(() => {
      expect(screen.getByText('No active sessions')).toBeInTheDocument();
    });
    expect(screen.getByText('No active queues configured')).toBeInTheDocument();
    expect(screen.getByText('No urgent runtime issues detected.')).toBeInTheDocument();
    expect(screen.getByText('No tenant gateway status snapshots available yet.')).toBeInTheDocument();
  });

  it('shows active session count in stat cards', async () => {
    mockApi({
      snapshot: {
        ...emptySnapshot,
        active_session_count: 3,
        recent_call_events_5m: 7,
        pending_approvals: 1,
      },
    });

    renderWithProviders(<ObservabilityCockpitPage />);

    await waitFor(() => {
      expect(screen.queryByText('...')).not.toBeInTheDocument();
    });
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

    mockApi({
      snapshot: { ...emptySnapshot, active_session_count: 1, running_sessions: [session] },
    });

    renderWithProviders(<ObservabilityCockpitPage />);

    await waitFor(() => {
      expect(screen.getByText('+14155550001')).toBeInTheDocument();
    });
    expect(screen.getByText('node-menu')).toBeInTheDocument();
  });

  it('renders queue depth cards', async () => {
    mockApi({
      snapshot: {
        ...emptySnapshot,
        queue_depths: [
          { queue_id: 'q-1', queue_name: 'Sales', member_count: 4 },
          { queue_id: 'q-2', queue_name: 'Support', member_count: 2 },
        ],
      },
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
    mockApi({
      snapshot: {
        ...emptySnapshot,
        webhook_backlog: { pending: 5, processing: 1, failed: 2, abandoned: 0 },
      },
    });

    renderWithProviders(<ObservabilityCockpitPage />);

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
    });
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('shows gateway registration and failed-call triage', async () => {
    mockApi({
      snapshot: {
        ...emptySnapshot,
        recent_session_failures_1h: 2,
      },
      gatewayStatus: [
        {
          trunk_id: 'trunk-1',
          trunk_name: 'Carrier A',
          node_id: 'node-1234567890abcdef',
          state: 'REGED',
          queried_at: new Date(Date.now() - 30_000).toISOString(),
        },
        {
          trunk_id: 'trunk-2',
          trunk_name: 'Carrier B',
          node_id: 'node-bbbbbbbbbbbbbbbb',
          state: 'FAILED',
          queried_at: new Date(Date.now() - 45_000).toISOString(),
        },
      ],
      callEvents: [
        {
          id: 'evt-1',
          tenant_id: 'tenant-1',
          call_id: 'call-1',
          event_type: 'outbound_call_failed',
          event_time: new Date(Date.now() - 60_000).toISOString(),
          source: 'freeswitch-agent',
          payload: { direction: 'outbound', to_number: '+14155550100', failure_reason: 'busy' },
          ingested_at: new Date(Date.now() - 59_000).toISOString(),
        },
      ],
    });

    renderWithProviders(<ObservabilityCockpitPage />);

    await waitFor(() => {
      expect(screen.getByText('Carrier B')).toBeInTheDocument();
    });
    expect(screen.getByText('FAILED')).toBeInTheDocument();
    expect(screen.getByText('Recent Failed Calls')).toBeInTheDocument();
    expect(screen.getByText('+14155550100')).toBeInTheDocument();
    expect(screen.getByText('Triage Queue')).toBeInTheDocument();
    expect(screen.getByText('Gateways not REGED')).toBeInTheDocument();
  });

  it('shows error state when API returns 403', async () => {
    mockApi({ error: new ApiError('Forbidden', 403) });

    renderWithProviders(<ObservabilityCockpitPage />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText('Operator access required')).toBeInTheDocument();
  });

  it('shows error state on auth failure', async () => {
    mockApi({ error: new ApiError('Unauthorized', 401) });

    renderWithProviders(<ObservabilityCockpitPage />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByText('Could not load live snapshot')).toBeInTheDocument();
  });

  it('does not render sensitive credential fields', async () => {
    mockApi();
    renderWithProviders(<ObservabilityCockpitPage />);

    await waitFor(() => {
      expect(screen.queryByText('password_hash')).not.toBeInTheDocument();
      expect(screen.queryByText('sip_password')).not.toBeInTheDocument();
      expect(screen.queryByText('signing_secret')).not.toBeInTheDocument();
    });
  });
});
