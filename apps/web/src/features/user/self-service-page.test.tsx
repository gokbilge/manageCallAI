import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { SelfServicePage } from './self-service-page';
import { ApiError, apiRequest } from '@/lib/api/client';

vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: () => ({
    session: { token: 'token', claims: { tenant_id: 'tenant-1', role: 'end_user' } },
  }),
}));

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiRequest: vi.fn() };
});

vi.mock('@/lib/provisioning/sip-provisioning', () => ({
  generateProvisioningQr: vi.fn().mockResolvedValue('data:image/png;base64,mockqr'),
  getSipServer: vi.fn().mockReturnValue('sip.example.com'),
  SUPPORTED_SIP_CLIENTS: [
    { name: 'Zoiper', platforms: 'iOS · Android · Desktop', url: 'https://www.zoiper.com', notes: 'Scan QR from login screen.' },
    { name: 'Linphone', platforms: 'iOS · Android · Desktop', url: 'https://www.linphone.org', notes: 'Tap "Use SIP account", scan QR.' },
    { name: 'MicroSIP', platforms: 'Windows only', url: 'https://www.microsip.org', notes: 'Manual entry required.' },
    { name: 'Bria (CounterPath)', platforms: 'iOS · Android · Desktop', url: 'https://www.counterpath.com', notes: 'Manual entry required.' },
  ],
}));

const extension = {
  id: 'ext-1',
  extension_number: '200',
  display_name: 'Alice Smith',
  sip_username: '200',
  dnd_enabled: false,
  call_forward_enabled: false,
  call_forward_target: null,
};

const voicemailMessages = [
  {
    id: 'vm-1',
    call_id: 'call-1',
    duration_secs: 11,
    size_bytes: 1024,
    read_at: null,
    recorded_at: '2026-06-05T00:00:00.000Z',
  },
];

const deviceRegistrations = [
  {
    id: 'reg-1',
    status: 'registered' as const,
    contact_domain: 'pbx.example.com',
    user_agent: 'Linphone',
    registered_at: '2026-06-05T00:00:00.000Z',
    last_seen_at: '2026-06-05T00:05:00.000Z',
  },
];

const callHistory = [
  {
    id: 'event-1',
    tenant_id: 'tenant-1',
    call_id: 'call-1',
    event_type: 'outbound_call_completed',
    event_time: '2026-06-05T00:05:00.000Z',
    source: 'freeswitch-agent',
    payload: { direction: 'outbound', from_number: '200', to_number: '+14155550100' },
    ingested_at: '2026-06-05T00:05:01.000Z',
  },
];

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <SelfServicePage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('SelfServicePage', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
    vi.mocked(apiRequest).mockImplementation(async (path, options) => {
      if (path === '/me/extension') return { data: extension };
      if (path === '/me/voicemail-messages') return { data: voicemailMessages };
      if (path === '/me/call-history') return { data: callHistory };
      if (path === '/me/devices') return { data: deviceRegistrations };
      if (path === '/me/dnd' && options?.method === 'PUT') return { data: { ...extension, dnd_enabled: true } };
      if (path === '/me/call-forward' && options?.method === 'PUT') return { data: { ...extension, call_forward_enabled: true, call_forward_target: '+14155550100' } };
      if (path === '/me/voicemail-messages/vm-1/read' && options?.method === 'POST') return { data: { ...voicemailMessages[0], read_at: '2026-06-05T00:06:00.000Z' } };
      if (path === '/me/voicemail-messages/vm-1' && options?.method === 'DELETE') return {};
      if (path === '/me/sip-credential/reset' && options?.method === 'POST') {
        return { data: { extension_id: 'ext-1', extension_number: '200', sip_username: '200', sip_password: 'mcai-new-secret' } };
      }
      if (path === '/me/devices/reg-1' && options?.method === 'DELETE') return { data: { id: 'reg-1', revoked: true } };
      throw new Error(`Unexpected request: ${String(options?.method ?? 'GET')} ${path}`);
    });
  });

  it('renders the end-user sections from the /me queries', async () => {
    renderPage();

    expect(screen.getByText('My Settings')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      expect(screen.getByText('Voicemail Inbox')).toBeInTheDocument();
      expect(screen.getByText('Call History')).toBeInTheDocument();
      expect(screen.getByText('Devices & Provisioning')).toBeInTheDocument();
      expect(screen.getByText('SIP Credential')).toBeInTheDocument();
      expect(screen.getByText('Linphone')).toBeInTheDocument();
      expect(screen.getByText('+14155550100')).toBeInTheDocument();
    });
  });

  it('calls the DND and call-forward endpoints from the page actions', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByRole('button', { name: /enable dnd/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /enable dnd/i }));
    fireEvent.click(screen.getByRole('button', { name: /save forwarding/i }));

    await waitFor(() => {
      expect(vi.mocked(apiRequest)).toHaveBeenCalledWith(
        '/me/dnd',
        expect.objectContaining({ method: 'PUT' }),
      );
      expect(vi.mocked(apiRequest)).toHaveBeenCalledWith(
        '/me/call-forward',
        expect.objectContaining({ method: 'PUT' }),
      );
    });
  });

  it('marks voicemail read, deletes messages, and shows one-time SIP password reset output', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByRole('button', { name: /mark read/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /mark read/i }));
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    fireEvent.click(screen.getByRole('button', { name: /reset sip password/i }));

    await waitFor(() => {
      expect(vi.mocked(apiRequest)).toHaveBeenCalledWith(
        '/me/voicemail-messages/vm-1/read',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(vi.mocked(apiRequest)).toHaveBeenCalledWith(
        '/me/voicemail-messages/vm-1',
        expect.objectContaining({ method: 'DELETE' }),
      );
      expect(screen.getByText('mcai-new-secret')).toBeInTheDocument();
    });
  });

  it('shows tenant-policy disabled state for gated sections', async () => {
    vi.mocked(apiRequest).mockImplementation(async (path) => {
      if (path === '/me/extension') return { data: extension };
      if (path === '/me/call-history') return { data: [] };
      if (path === '/me/voicemail-messages') throw new ApiError('disabled', 403);
      if (path === '/me/devices') throw new ApiError('disabled', 403);
      throw new Error(`Unexpected request: GET ${path}`);
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/disabled voicemail self-service/i)).toBeInTheDocument();
      expect(screen.getByText(/disabled device visibility/i)).toBeInTheDocument();
    });
  });

  it('shows revoke button for each registered device and requires confirm', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: /revoke linphone/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /revoke linphone/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /confirm revoke/i })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /cancel revoke/i })).toBeInTheDocument();
  });

  it('calls DELETE /me/devices/:id after revoke confirmed', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: /revoke linphone/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /revoke linphone/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /confirm revoke/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /confirm revoke/i }));
    await waitFor(() => {
      expect(vi.mocked(apiRequest)).toHaveBeenCalledWith(
        '/me/devices/reg-1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  it('cancelling revoke confirm hides confirm buttons', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: /revoke linphone/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /revoke linphone/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /cancel revoke/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /cancel revoke/i }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /confirm revoke/i })).not.toBeInTheDocument());
  });

  it('shows softphone setup guide and client list when no devices are registered', async () => {
    vi.mocked(apiRequest).mockImplementation(async (path, options) => {
      if (path === '/me/extension') return { data: extension };
      if (path === '/me/voicemail-messages') return { data: [] };
      if (path === '/me/call-history') return { data: [] };
      if (path === '/me/devices') return { data: [] };
      if (path === '/me/sip-credential/reset' && options?.method === 'POST') {
        return { data: { extension_id: 'ext-1', extension_number: '200', sip_username: '200', sip_password: 'mcai-new-secret' } };
      }
      throw new Error(`Unexpected: ${path}`);
    });
    renderPage();
    await waitFor(() => expect(screen.getAllByText(/Set up a softphone/i).length).toBeGreaterThan(0));
    expect(screen.getByText('Zoiper')).toBeInTheDocument();
    expect(screen.getByText('Linphone')).toBeInTheDocument();
    expect(screen.getByText('MicroSIP')).toBeInTheDocument();
  });

  it('shows QR code after SIP credential reset when sip server is configured', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole('button', { name: /reset sip password/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /reset sip password/i }));
    await waitFor(() => {
      expect(screen.getByText('mcai-new-secret')).toBeInTheDocument();
      expect(screen.getByAltText('SIP provisioning QR code')).toBeInTheDocument();
    });
    expect(screen.getByText(/Scan to provision your softphone/i)).toBeInTheDocument();
  });

  it('shows extension-not-linked state when /me/extension returns 404', async () => {
    vi.mocked(apiRequest).mockImplementation(async (path) => {
      if (path === '/me/extension') throw new ApiError('No extension', 404);
      if (path === '/me/voicemail-messages') return { data: [] };
      if (path === '/me/call-history') return { data: [] };
      if (path === '/me/devices') return { data: [] };
      throw new Error(`Unexpected request: GET ${path}`);
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/no extension is linked to your account/i)).toBeInTheDocument();
    });
  });
});
