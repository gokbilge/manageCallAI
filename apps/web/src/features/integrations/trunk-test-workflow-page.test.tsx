import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TrunkTestWorkflowPage } from './trunk-test-workflow-page';
import { renderWithProviders } from '@/test/render';
import { apiRequest } from '@/lib/api/client';

vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: () => ({
    session: { token: 'token', claims: { tenant_id: 'tenant-1', role: 'tenant_operator' } },
  }),
}));

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiRequest: vi.fn() };
});

const stubTrunk = {
  id: 'trunk-1',
  tenant_id: 'tenant-1',
  name: 'Primary Carrier',
  direction: 'bidirectional',
  status: 'active',
  username: null,
  realm: 'sip.carrier.example',
  proxy: '10.0.0.1',
  port: 5060,
  transport: 'udp',
  auth_username: 'user1',
  dtmf_mode: 'rfc2833',
  codec_prefs: null,
  srtp_policy: 'disabled',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const stubGatewayEntry = {
  trunk_id: 'trunk-1',
  trunk_name: 'Primary Carrier',
  node_id: 'node-uuid-1',
  state: 'REGED',
  queried_at: new Date().toISOString(),
};

function setupMocks(overrides: {
  trunks?: object[];
  gateway?: object[];
} = {}) {
  vi.mocked(apiRequest).mockImplementation(async (path: string) => {
    const p = String(path);
    if (p.includes('gateway-status')) {
      return { data: overrides.gateway ?? [stubGatewayEntry] };
    }
    if (p.includes('sip-trunks')) {
      return { data: overrides.trunks ?? [stubTrunk] };
    }
    return { data: [] };
  });
}

describe('TrunkTestWorkflowPage', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  it('renders heading and description', () => {
    setupMocks();
    renderWithProviders(<TrunkTestWorkflowPage />);
    expect(screen.getByText('Carrier & Trunk Test Workflow')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /run connectivity test/i })).toBeInTheDocument();
  });

  it('shows empty state when no active trunks exist', async () => {
    setupMocks({ trunks: [] });
    renderWithProviders(<TrunkTestWorkflowPage />);
    await waitFor(() => {
      expect(screen.getByText('No active trunks')).toBeInTheDocument();
    });
  });

  it('shows trunk list when trunks load', async () => {
    setupMocks();
    renderWithProviders(<TrunkTestWorkflowPage />);
    await waitFor(() => {
      expect(screen.getAllByText('Primary Carrier').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('disables run button until a trunk is selected', async () => {
    setupMocks();
    renderWithProviders(<TrunkTestWorkflowPage />);
    const btn = screen.getByRole('button', { name: /run connectivity test/i });
    expect(btn).toBeDisabled();
  });

  it('enables run button after trunk is selected', async () => {
    setupMocks();
    renderWithProviders(<TrunkTestWorkflowPage />);
    await screen.findByText('sip.carrier.example');
    fireEvent.click(screen.getByText('sip.carrier.example').closest('button')!);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /run connectivity test/i })).not.toBeDisabled();
    });
  });

  async function selectAndRun() {
    await screen.findByText('sip.carrier.example');
    fireEvent.click(screen.getByText('sip.carrier.example').closest('button')!);
    fireEvent.click(screen.getByRole('button', { name: /run connectivity test/i }));
  }

  it('shows passed result after successful test (REGED state)', async () => {
    setupMocks();
    renderWithProviders(<TrunkTestWorkflowPage />);
    await selectAndRun();
    await waitFor(() => {
      expect(screen.getAllByText('Passed').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows passed guidance when trunk is REGED', async () => {
    setupMocks();
    renderWithProviders(<TrunkTestWorkflowPage />);
    await selectAndRun();
    await waitFor(() => {
      expect(screen.getByText('Trunk is registered and reachable')).toBeInTheDocument();
    });
  });

  it('shows failed result when trunk is DOWN', async () => {
    setupMocks({ gateway: [{ ...stubGatewayEntry, state: 'DOWN' }] });
    renderWithProviders(<TrunkTestWorkflowPage />);
    await selectAndRun();
    await waitFor(() => {
      expect(screen.getAllByText('Failed').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows failure guidance when trunk is DOWN', async () => {
    setupMocks({ gateway: [{ ...stubGatewayEntry, state: 'DOWN' }] });
    renderWithProviders(<TrunkTestWorkflowPage />);
    await selectAndRun();
    await waitFor(() => {
      expect(screen.getByText(/Trunk is DOWN — registration failed/)).toBeInTheDocument();
    });
  });

  it('shows failed result when trunk is FAILED', async () => {
    setupMocks({ gateway: [{ ...stubGatewayEntry, state: 'FAILED' }] });
    renderWithProviders(<TrunkTestWorkflowPage />);
    await selectAndRun();
    await waitFor(() => {
      expect(screen.getAllByText('Failed').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows in_progress result when trunk is TRYING', async () => {
    setupMocks({ gateway: [{ ...stubGatewayEntry, state: 'TRYING' }] });
    renderWithProviders(<TrunkTestWorkflowPage />);
    await selectAndRun();
    await waitFor(() => {
      expect(screen.getAllByText('In progress').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows TRYING guidance', async () => {
    setupMocks({ gateway: [{ ...stubGatewayEntry, state: 'TRYING' }] });
    renderWithProviders(<TrunkTestWorkflowPage />);
    await selectAndRun();
    await waitFor(() => {
      expect(screen.getByText(/Registration in progress/)).toBeInTheDocument();
    });
  });

  it('shows unknown result when no gateway data', async () => {
    setupMocks({ gateway: [] });
    renderWithProviders(<TrunkTestWorkflowPage />);
    await selectAndRun();
    await waitFor(() => {
      expect(screen.getAllByText('No data').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows no-data guidance when gateway entry is missing', async () => {
    setupMocks({ gateway: [] });
    renderWithProviders(<TrunkTestWorkflowPage />);
    await selectAndRun();
    await waitFor(() => {
      expect(screen.getByText('No runtime data for this trunk')).toBeInTheDocument();
    });
  });

  it('adds test to history after run', async () => {
    setupMocks();
    renderWithProviders(<TrunkTestWorkflowPage />);
    await selectAndRun();
    await waitFor(() => {
      // History table shows the result row with trunk name
      expect(screen.getAllByText('Primary Carrier').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('shows empty history before any tests are run', () => {
    setupMocks();
    renderWithProviders(<TrunkTestWorkflowPage />);
    expect(screen.getByText('No tests run yet in this session.')).toBeInTheDocument();
  });

  it('shows live gateway state table when gateway data is available', async () => {
    setupMocks();
    renderWithProviders(<TrunkTestWorkflowPage />);
    await waitFor(() => {
      expect(screen.getByText('Live gateway state')).toBeInTheDocument();
      expect(screen.getAllByText('REGED').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('does not show gateway state table when no entries', async () => {
    setupMocks({ gateway: [] });
    renderWithProviders(<TrunkTestWorkflowPage />);
    // trunk list loads (no active trunks message should NOT appear since stubTrunk is active)
    await screen.findByText('sip.carrier.example');
    expect(screen.queryByText('Live gateway state')).not.toBeInTheDocument();
  });

  it('shows carrier test checklist', () => {
    setupMocks();
    renderWithProviders(<TrunkTestWorkflowPage />);
    expect(screen.getByText('sip_register')).toBeInTheDocument();
    expect(screen.getByText('inbound_call')).toBeInTheDocument();
    expect(screen.getByText('outbound_call')).toBeInTheDocument();
  });

  it('shows error when trunk list fails to load', async () => {
    vi.mocked(apiRequest).mockImplementation(async (path: string) => {
      if (String(path).includes('gateway-status')) return { data: [] };
      throw new Error('network failure');
    });
    renderWithProviders(<TrunkTestWorkflowPage />);
    await waitFor(() => {
      expect(screen.getByText('Could not load SIP trunks.')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('shows result card with correct trunk info line', async () => {
    setupMocks();
    renderWithProviders(<TrunkTestWorkflowPage />);
    await screen.findByText('sip.carrier.example');
    fireEvent.click(screen.getByText('sip.carrier.example').closest('button')!);
    await waitFor(() => {
      // The info line contains "Testing:" as text node and trunk name in span
      expect(screen.getByText((text, el) =>
        el?.tagName === 'P' && el.textContent?.includes('Testing:') === true && el.textContent?.includes('Primary Carrier') === true,
      )).toBeInTheDocument();
    });
  });
});
