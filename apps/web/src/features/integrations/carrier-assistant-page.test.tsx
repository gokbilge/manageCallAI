import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CarrierAssistantPage } from './carrier-assistant-page';
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

const trunk = {
  id: 'trunk-1',
  tenant_id: 'tenant-1',
  name: 'Primary Carrier',
  direction: 'bidirectional',
  status: 'active',
  username: null,
  realm: 'sip.carrier.example',
  proxy: 'sip.carrier.example',
  port: 5060,
  transport: 'udp',
  auth_username: 'carrier-user',
  dtmf_mode: 'rfc2833',
  codec_prefs: null,
  srtp_policy: 'disabled',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const suggestion = {
  assistant_mode: 'create',
  target_trunk_id: null,
  target_trunk_name: null,
  matched_template: 'Twilio Elastic SIP',
  suggested_config: {
    name: 'Twilio Elastic SIP trunk',
    direction: 'bidirectional',
    username: null,
    realm: 'sip.twilio.example',
    proxy: 'sip.twilio.example',
    port: 5061,
    transport: 'tls',
    auth_username: 'twilio-user',
    dtmf_mode: 'rfc2833',
    codec_prefs: null,
    srtp_policy: 'optional',
  },
  missing_fields: [{ field: 'auth_password', reason: 'Enter the secret manually.' }],
  assumptions: ['Assumed Twilio Elastic SIP defaults.'],
  warnings: [],
  validation_errors: ['auth_password: Enter the secret manually.'],
  validation_checks: [{ code: 'required_fields', description: 'Review required fields.', status: 'needs_input' }],
  next_steps: ['Save the draft through the SIP trunk workflow.'],
  runtime_hint: null,
};

const updateSuggestion = {
  ...suggestion,
  assistant_mode: 'update',
  target_trunk_id: trunk.id,
  target_trunk_name: trunk.name,
  matched_template: 'Telnyx SIP trunk',
  warnings: ['Reload the gateway after saving the draft.'],
  runtime_hint: {
    gateway_state: 'failed',
    latest_apply_status: 'failed',
    latest_apply_error: 'Gateway rejected TLS handshake.',
  },
};

describe('CarrierAssistantPage', () => {
  beforeEach(() => vi.mocked(apiRequest).mockReset());

  it('renders the empty draft state before any suggestion exists', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [trunk] });

    renderWithProviders(<CarrierAssistantPage />);

    await screen.findByText('Primary Carrier');
    expect(screen.getByText(/Ask for a carrier draft to see the suggested configuration/i)).toBeInTheDocument();
  });

  it('renders and submits a carrier brief', async () => {
    vi.mocked(apiRequest).mockImplementation(async (path: string, options?: { method?: string }) => {
      if (options?.method === 'POST') return { data: suggestion };
      if (String(path).includes('/sip-trunks')) return { data: [trunk] };
      return { data: [] };
    });

    renderWithProviders(<CarrierAssistantPage />);
    fireEvent.change(screen.getByPlaceholderText(/Set up a Telnyx TLS trunk/i), {
      target: { value: 'Create a Twilio SIP trunk using sip.twilio.example and auth username twilio-user' },
    });
    fireEvent.click(screen.getByRole('button', { name: /suggest draft/i }));

    await waitFor(() => expect(screen.getByText('Twilio Elastic SIP')).toBeInTheDocument());
    expect(screen.getAllByText('auth_password: Enter the secret manually.')).toHaveLength(2);
  });

  it('renders update-mode runtime hints for an existing trunk', async () => {
    vi.mocked(apiRequest).mockImplementation(async (path: string, options?: { method?: string }) => {
      if (options?.method === 'POST') return { data: updateSuggestion };
      if (String(path).includes('/sip-trunks')) return { data: [trunk] };
      return { data: [] };
    });

    renderWithProviders(<CarrierAssistantPage />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: trunk.id } });
    fireEvent.change(screen.getByPlaceholderText(/Set up a Telnyx TLS trunk/i), {
      target: { value: 'Update the primary carrier to TLS on port 5061' },
    });
    fireEvent.click(screen.getByRole('button', { name: /suggest draft/i }));

    await screen.findByText('Telnyx SIP trunk');
    expect(screen.getByText(/Gateway state: failed/i)).toBeInTheDocument();
    expect(screen.getByText('Gateway rejected TLS handshake.')).toBeInTheDocument();
    expect(screen.getByText('Reload the gateway after saving the draft.')).toBeInTheDocument();
  });

  it('renders request failures', async () => {
    vi.mocked(apiRequest).mockImplementation(async (path: string, options?: { method?: string }) => {
      if (options?.method === 'POST') throw new Error('draft failed');
      if (String(path).includes('/sip-trunks')) return { data: [trunk] };
      return { data: [] };
    });

    renderWithProviders(<CarrierAssistantPage />);
    fireEvent.change(screen.getByPlaceholderText(/Set up a Telnyx TLS trunk/i), {
      target: { value: 'Create a Twilio SIP trunk using sip.twilio.example and auth username twilio-user' },
    });
    fireEvent.click(screen.getByRole('button', { name: /suggest draft/i }));

    await screen.findByText('draft failed');
  });
});
