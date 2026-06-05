import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CarrierHealthPage } from './carrier-health-page';
import { renderWithProviders } from '@/test/render';
import { apiRequest } from '@/lib/api/client';

vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: () => ({
    session: { token: 'token', claims: { tenant_id: 't1', role: 'tenant_operator' } },
  }),
}));

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiRequest: vi.fn() };
});

const stubTrunk = {
  id: 'trunk-1',
  tenant_id: 't1',
  name: 'Primary Carrier',
  direction: 'bidirectional',
  status: 'active',
  username: null,
  realm: 'sip.carrier.example',
  proxy: '10.0.0.1',
  port: 5060,
  transport: 'udp',
  auth_username: 'u1',
  dtmf_mode: 'rfc2833',
  codec_prefs: null,
  srtp_policy: 'disabled',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const stubGateway = {
  trunk_id: 'trunk-1',
  trunk_name: 'Primary Carrier',
  node_id: 'node-uuid-1',
  state: 'REGED',
  queried_at: new Date().toISOString(),
};

function setupMocks(trunks = [stubTrunk], gateway = [stubGateway]) {
  vi.mocked(apiRequest).mockImplementation(async (path: string) => {
    if (String(path).includes('gateway-status')) return { data: gateway };
    return { data: trunks };
  });
}

describe('CarrierHealthPage', () => {
  beforeEach(() => vi.mocked(apiRequest).mockReset());

  it('renders page heading', () => {
    setupMocks();
    renderWithProviders(<CarrierHealthPage />);
    expect(screen.getByText('Carrier Health')).toBeInTheDocument();
  });

  it('shows overall healthy status when all trunks registered', async () => {
    setupMocks();
    renderWithProviders(<CarrierHealthPage />);
    await waitFor(() => {
      expect(screen.getAllByText('Registered').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows overall down status when a trunk is DOWN', async () => {
    setupMocks([stubTrunk], [{ ...stubGateway, state: 'DOWN' }]);
    renderWithProviders(<CarrierHealthPage />);
    await waitFor(() => {
      expect(screen.getAllByText('Down').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows degraded for TRYING state', async () => {
    setupMocks([stubTrunk], [{ ...stubGateway, state: 'TRYING' }]);
    renderWithProviders(<CarrierHealthPage />);
    await waitFor(() => {
      expect(screen.getAllByText('Registering').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows unknown status for trunk with no gateway data', async () => {
    setupMocks([stubTrunk], []);
    renderWithProviders(<CarrierHealthPage />);
    await waitFor(() => {
      expect(screen.getAllByText('No data').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows trunk name in the health card', async () => {
    setupMocks();
    renderWithProviders(<CarrierHealthPage />);
    await waitFor(() => {
      expect(screen.getAllByText('Primary Carrier').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows empty state when no active trunks', async () => {
    setupMocks([], []);
    renderWithProviders(<CarrierHealthPage />);
    await waitFor(() => {
      expect(screen.getByText('No active trunks. Add and activate a SIP trunk to see health data.')).toBeInTheDocument();
    });
  });

  it('does not show error text in happy path', async () => {
    setupMocks();
    renderWithProviders(<CarrierHealthPage />);
    await waitFor(() => expect(screen.getAllByText('Primary Carrier').length).toBeGreaterThanOrEqual(1));
    expect(screen.queryByText('Could not load trunks.')).not.toBeInTheDocument();
  });

  it('shows health summary counts', async () => {
    setupMocks();
    renderWithProviders(<CarrierHealthPage />);
    await waitFor(() => {
      expect(screen.getByText(/1 registered/)).toBeInTheDocument();
    });
  });

  it('renders refresh button', () => {
    setupMocks();
    renderWithProviders(<CarrierHealthPage />);
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
  });
});
