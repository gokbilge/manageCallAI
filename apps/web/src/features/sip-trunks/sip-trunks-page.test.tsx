import { screen, waitFor } from '@testing-library/react';
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

describe('SipTrunksPage', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  it('shows empty state when no trunks exist', async () => {
    vi.mocked(apiRequest).mockImplementation(async (path: string) => {
      if (String(path).includes('gateway-status')) return { data: [] };
      return { data: [] };
    });

    renderWithProviders(<SipTrunksPage />);

    await waitFor(() => {
      expect(screen.getByText('No trunks yet. Add one to connect a carrier.')).toBeInTheDocument();
    });
  });

  it('renders trunk rows from API data', async () => {
    vi.mocked(apiRequest).mockImplementation(async (path: string) => {
      if (String(path).includes('gateway-status')) return { data: [] };
      return { data: [stubTrunk] };
    });

    renderWithProviders(<SipTrunksPage />);

    await waitFor(() => {
      expect(screen.getByText('Main Carrier')).toBeInTheDocument();
      expect(screen.getByText('sip.carrier.com')).toBeInTheDocument();
    });
  });

  it('shows gateway state when status data is present', async () => {
    vi.mocked(apiRequest).mockImplementation(async (path: string) => {
      if (String(path).includes('gateway-status')) {
        return {
          data: [{
            trunk_id: 'trunk-uuid-1',
            trunk_name: 'Main Carrier',
            node_id: 'node-uuid-1',
            state: 'REGED',
            queried_at: new Date().toISOString(),
          }],
        };
      }
      return { data: [stubTrunk] };
    });

    renderWithProviders(<SipTrunksPage />);

    await waitFor(() => {
      expect(screen.getByText('REGED')).toBeInTheDocument();
    });
  });

  it('renders heading and add trunk button', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [] });

    renderWithProviders(<SipTrunksPage />);

    expect(screen.getByText('SIP Trunks')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add trunk/i })).toBeInTheDocument();
  });
});
