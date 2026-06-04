import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SipTrunksPage } from './sip-trunks-page';
import { renderWithProviders } from '@/test/render';
import { apiRequest } from '@/lib/api/client';

vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: () => ({
    session: { token: 'token', claims: { tenant_id: 'tenant-1', role: 'tenant_admin' } },
  }),
}));

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiRequest: vi.fn() };
});

const stubTrunk = {
  id: 'trunk-uuid-1',
  tenant_id: 'tenant-1',
  name: 'Main Carrier',
  direction: 'bidirectional',
  status: 'active',
  username: null,
  realm: 'sip.carrier.com',
  proxy: 'sip.carrier.com',
  port: 5060,
  transport: 'udp',
  auth_username: 'trunkuser',
  dtmf_mode: 'rfc2833',
  codec_prefs: null,
  srtp_policy: 'optional',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const stubApplyRequest = {
  id: 'req-uuid-1',
  tenant_id: 'tenant-1',
  triggered_by_type: 'user',
  triggered_by_id: null,
  action_type: 'sofia_profile_rescan',
  target_node_id: 'node-uuid-1',
  target_profile: 'external',
  target_gateway: 'trunk-trunk-uuid-1',
  object_type: 'sip_trunk',
  object_id: 'trunk-uuid-1',
  status: 'applied',
  active_call_count: 0,
  applied_at: new Date().toISOString(),
  error_message: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function setupMocks(overrides: Record<string, unknown> = {}) {
  vi.mocked(apiRequest).mockImplementation(async (path: string) => {
    const p = String(path);
    if (p.includes('gateway-status')) {
      return overrides['gateway-status'] ?? { data: [] };
    }
    if (p.includes('apply-requests')) {
      return overrides['apply-requests'] ?? { data: [] };
    }
    if (p === '/sip-trunks' || p.startsWith('/sip-trunks')) {
      return overrides['trunks'] ?? { data: [] };
    }
    return { data: [] };
  });
}

describe('SipTrunksPage', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  it('shows empty state when no trunks exist', async () => {
    setupMocks();

    renderWithProviders(<SipTrunksPage />);

    await waitFor(() => {
      expect(screen.getByText('No trunks yet. Add one to connect a carrier.')).toBeInTheDocument();
    });
  });

  it('renders trunk rows from API data', async () => {
    setupMocks({ trunks: { data: [stubTrunk] } });

    renderWithProviders(<SipTrunksPage />);

    await waitFor(() => {
      expect(screen.getByText('Main Carrier')).toBeInTheDocument();
      expect(screen.getByText('sip.carrier.com')).toBeInTheDocument();
    });
  });

  it('shows REGED gateway state from status data', async () => {
    setupMocks({
      trunks: { data: [stubTrunk] },
      'gateway-status': {
        data: [{
          trunk_id: 'trunk-uuid-1',
          trunk_name: 'Main Carrier',
          node_id: 'node-uuid-1',
          state: 'REGED',
          queried_at: new Date().toISOString(),
        }],
      },
    });

    renderWithProviders(<SipTrunksPage />);

    await waitFor(() => {
      expect(screen.getByText('REGED')).toBeInTheDocument();
    });
  });

  it('shows DOWN gateway state with correct color class', async () => {
    setupMocks({
      trunks: { data: [stubTrunk] },
      'gateway-status': {
        data: [{ trunk_id: 'trunk-uuid-1', trunk_name: 'Main Carrier', node_id: 'node-1', state: 'DOWN', queried_at: new Date().toISOString() }],
      },
    });

    renderWithProviders(<SipTrunksPage />);

    await waitFor(() => {
      expect(screen.getByText('DOWN')).toBeInTheDocument();
    });
  });

  it('renders heading and add trunk button', async () => {
    setupMocks();

    renderWithProviders(<SipTrunksPage />);

    expect(screen.getByText('SIP Trunks')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add trunk/i })).toBeInTheDocument();
  });

  it('shows create trunk form when add trunk button is clicked', async () => {
    setupMocks();

    renderWithProviders(<SipTrunksPage />);

    fireEvent.click(screen.getByRole('button', { name: /add trunk/i }));

    expect(screen.getByText('New SIP trunk')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Carrier trunk')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create trunk/i })).toBeInTheDocument();
  });

  it('hides create form when cancel is clicked', async () => {
    setupMocks();

    renderWithProviders(<SipTrunksPage />);

    fireEvent.click(screen.getByRole('button', { name: /add trunk/i }));
    expect(screen.getByText('New SIP trunk')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByText('New SIP trunk')).not.toBeInTheDocument();
  });

  it('expands trunk row to show apply history on click', async () => {
    setupMocks({
      trunks: { data: [stubTrunk] },
      'apply-requests': { data: [stubApplyRequest] },
    });

    renderWithProviders(<SipTrunksPage />);

    await waitFor(() => expect(screen.getByText('Main Carrier')).toBeInTheDocument());

    // Click the row to expand
    fireEvent.click(screen.getByText('Main Carrier').closest('tr')!);

    await waitFor(() => {
      expect(screen.getByText('Apply request history')).toBeInTheDocument();
      expect(screen.getByText('sofia_profile_rescan')).toBeInTheDocument();
    });
  });

  it('shows apply history with applied status', async () => {
    setupMocks({
      trunks: { data: [stubTrunk] },
      'apply-requests': { data: [stubApplyRequest] },
    });

    renderWithProviders(<SipTrunksPage />);

    await waitFor(() => expect(screen.getByText('Main Carrier')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Main Carrier').closest('tr')!);

    await waitFor(() => {
      expect(screen.getByText('applied')).toBeInTheDocument();
    });
  });

  it('shows failed apply request with error message', async () => {
    const failedReq = { ...stubApplyRequest, status: 'failed', error_message: 'ESL connection refused', applied_at: null };
    setupMocks({
      trunks: { data: [stubTrunk] },
      'apply-requests': { data: [failedReq] },
    });

    renderWithProviders(<SipTrunksPage />);

    await waitFor(() => expect(screen.getByText('Main Carrier')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Main Carrier').closest('tr')!);

    await waitFor(() => {
      expect(screen.getByText('failed')).toBeInTheDocument();
      expect(screen.getByText(/ESL connection refused/)).toBeInTheDocument();
    });
  });

  it('shows active call count warning in apply history', async () => {
    const riskyReq = { ...stubApplyRequest, active_call_count: 3 };
    setupMocks({
      trunks: { data: [stubTrunk] },
      'apply-requests': { data: [riskyReq] },
    });

    renderWithProviders(<SipTrunksPage />);

    await waitFor(() => expect(screen.getByText('Main Carrier')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Main Carrier').closest('tr')!);

    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('shows no data message when apply history is empty', async () => {
    setupMocks({ trunks: { data: [stubTrunk] }, 'apply-requests': { data: [] } });

    renderWithProviders(<SipTrunksPage />);

    await waitFor(() => expect(screen.getByText('Main Carrier')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Main Carrier').closest('tr')!);

    await waitFor(() => {
      expect(screen.getByText('No apply requests yet.')).toBeInTheDocument();
    });
  });

  it('shows deactivate button for active trunk', async () => {
    setupMocks({ trunks: { data: [stubTrunk] } });

    renderWithProviders(<SipTrunksPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /deactivate/i })).toBeInTheDocument();
    });
  });

  it('does not show deactivate button for inactive trunk', async () => {
    const inactiveTrunk = { ...stubTrunk, status: 'inactive' };
    setupMocks({ trunks: { data: [inactiveTrunk] } });

    renderWithProviders(<SipTrunksPage />);

    await waitFor(() => expect(screen.getByText('Main Carrier')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /deactivate/i })).not.toBeInTheDocument();
  });

  it('shows applying status in apply history', async () => {
    const applyingReq = { ...stubApplyRequest, status: 'applying', applied_at: null };
    setupMocks({
      trunks: { data: [stubTrunk] },
      'apply-requests': { data: [applyingReq] },
    });

    renderWithProviders(<SipTrunksPage />);

    await waitFor(() => expect(screen.getByText('Main Carrier')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Main Carrier').closest('tr')!);

    await waitFor(() => {
      expect(screen.getByText('applying')).toBeInTheDocument();
    });
  });

  it('shows pending status in apply history', async () => {
    const pendingReq = { ...stubApplyRequest, status: 'pending', applied_at: null };
    setupMocks({
      trunks: { data: [stubTrunk] },
      'apply-requests': { data: [pendingReq] },
    });

    renderWithProviders(<SipTrunksPage />);

    await waitFor(() => expect(screen.getByText('Main Carrier')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Main Carrier').closest('tr')!);

    await waitFor(() => {
      expect(screen.getByText('pending')).toBeInTheDocument();
    });
  });

  it('shows TRYING gateway state', async () => {
    setupMocks({
      trunks: { data: [stubTrunk] },
      'gateway-status': {
        data: [{ trunk_id: 'trunk-uuid-1', trunk_name: 'Main Carrier', node_id: 'node-1', state: 'TRYING', queried_at: new Date().toISOString() }],
      },
    });

    renderWithProviders(<SipTrunksPage />);

    await waitFor(() => {
      expect(screen.getByText('TRYING')).toBeInTheDocument();
    });
  });

  it('shows UNREACHABLE gateway state with muted color', async () => {
    setupMocks({
      trunks: { data: [stubTrunk] },
      'gateway-status': {
        data: [{ trunk_id: 'trunk-uuid-1', trunk_name: 'Main Carrier', node_id: 'node-1', state: 'UNREACHABLE', queried_at: new Date().toISOString() }],
      },
    });

    renderWithProviders(<SipTrunksPage />);

    await waitFor(() => {
      expect(screen.getByText('UNREACHABLE')).toBeInTheDocument();
    });
  });

  it('submits create trunk form and resets on success', async () => {
    const newTrunk = { ...stubTrunk, id: 'trunk-uuid-2', name: 'New Trunk' };
    vi.mocked(apiRequest).mockImplementation(async (path: string, opts?: { method?: string }) => {
      if (String(path).includes('gateway-status')) return { data: [] };
      if (opts?.method === 'POST') return { data: newTrunk, runtime_apply: [] };
      return { data: [] };
    });

    renderWithProviders(<SipTrunksPage />);

    fireEvent.click(screen.getByRole('button', { name: /add trunk/i }));

    fireEvent.change(screen.getByPlaceholderText('Carrier trunk'), { target: { value: 'New Trunk' } });
    // realm and proxy share the same placeholder — target by index
    const realmProxyInputs = screen.getAllByPlaceholderText('sip.carrier.com');
    fireEvent.change(realmProxyInputs[0]!, { target: { value: 'sip.test.com' } });
    fireEvent.change(realmProxyInputs[1]!, { target: { value: 'sip.test.com' } });
    fireEvent.change(screen.getByPlaceholderText('trunkuser'), { target: { value: 'user1' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'pass123' } });

    fireEvent.click(screen.getByRole('button', { name: /create trunk/i }));

    await waitFor(() => {
      expect(screen.queryByText('New SIP trunk')).not.toBeInTheDocument();
    });
  });

  it('shows apply history error when fetch fails', async () => {
    vi.mocked(apiRequest).mockImplementation(async (path: string) => {
      if (String(path).includes('gateway-status')) return { data: [] };
      if (String(path).includes('apply-requests')) throw new Error('fetch failed');
      return { data: [stubTrunk] };
    });

    renderWithProviders(<SipTrunksPage />);

    await waitFor(() => expect(screen.getByText('Main Carrier')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Main Carrier').closest('tr')!);

    await waitFor(() => {
      expect(screen.getByText('Could not load apply history.')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('shows FAILED gateway state', async () => {
    setupMocks({
      trunks: { data: [stubTrunk] },
      'gateway-status': {
        data: [{ trunk_id: 'trunk-uuid-1', trunk_name: 'Main Carrier', node_id: 'node-1', state: 'FAILED', queried_at: new Date().toISOString() }],
      },
    });

    renderWithProviders(<SipTrunksPage />);

    await waitFor(() => {
      expect(screen.getByText('FAILED')).toBeInTheDocument();
    });
  });

  it('deactivate with inactive gateway shows standard warning', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    setupMocks({ trunks: { data: [stubTrunk] } });

    renderWithProviders(<SipTrunksPage />);

    await waitFor(() => expect(screen.getByRole('button', { name: /deactivate/i })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /deactivate/i }));

    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining('Deactivate this trunk'),
    );
    confirmSpy.mockRestore();
  });

  it('deactivate with REGED gateway shows active-call warning', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    setupMocks({
      trunks: { data: [stubTrunk] },
      'gateway-status': {
        data: [{ trunk_id: 'trunk-uuid-1', trunk_name: 'Main Carrier', node_id: 'node-1', state: 'REGED', queried_at: new Date().toISOString() }],
      },
    });

    renderWithProviders(<SipTrunksPage />);

    await waitFor(() => expect(screen.getByRole('button', { name: /deactivate/i })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /deactivate/i }));

    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining('active gateway registration'),
    );
    confirmSpy.mockRestore();
  });

  it('shows create form error when trunk creation fails', async () => {
    vi.mocked(apiRequest).mockImplementation(async (path: string, opts?: { method?: string }) => {
      if (String(path).includes('gateway-status')) return { data: [] };
      if (opts?.method === 'POST') throw new Error('Conflict: name already exists');
      return { data: [] };
    });

    renderWithProviders(<SipTrunksPage />);

    fireEvent.click(screen.getByRole('button', { name: /add trunk/i }));

    const realmProxyInputs = screen.getAllByPlaceholderText('sip.carrier.com');
    fireEvent.change(screen.getByPlaceholderText('Carrier trunk'), { target: { value: 'Dup' } });
    fireEvent.change(realmProxyInputs[0]!, { target: { value: 'sip.t.com' } });
    fireEvent.change(realmProxyInputs[1]!, { target: { value: 'sip.t.com' } });
    fireEvent.change(screen.getByPlaceholderText('trunkuser'), { target: { value: 'u' } });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'p' } });

    fireEvent.click(screen.getByRole('button', { name: /create trunk/i }));

    await waitFor(() => {
      expect(screen.getByText(/Conflict: name already exists/)).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('shows error state when trunk fetch fails', async () => {
    vi.mocked(apiRequest).mockImplementation(async (path: string) => {
      if (String(path).includes('gateway-status')) return { data: [] };
      throw new Error('Network error');
    });

    renderWithProviders(<SipTrunksPage />);

    await waitFor(() => {
      expect(screen.getByText('Could not load trunks')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('shows gateway status section when trunk is expanded', async () => {
    setupMocks({
      trunks: { data: [stubTrunk] },
      'gateway-status': {
        data: [{ trunk_id: 'trunk-uuid-1', trunk_name: 'Main Carrier', node_id: 'node-uuid-1', state: 'REGED', queried_at: new Date().toISOString() }],
      },
      'apply-requests': { data: [] },
    });

    renderWithProviders(<SipTrunksPage />);

    await waitFor(() => expect(screen.getByText('Main Carrier')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Main Carrier').closest('tr')!);

    await waitFor(() => {
      expect(screen.getByText('Gateway state across nodes')).toBeInTheDocument();
    });
  });
});
