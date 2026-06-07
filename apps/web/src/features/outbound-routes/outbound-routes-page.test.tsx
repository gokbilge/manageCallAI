import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { OutboundRoutesPage } from './outbound-routes-page';
import { apiRequest } from '@/lib/api/client';

vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: () => ({
    session: { token: 'test-token', claims: { tenant_id: 'tenant-1' } },
  }),
}));

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiRequest: vi.fn() };
});

const activeRoute = {
  id: 'r-1',
  name: 'International',
  status: 'active',
  match_prefix: '+',
  priority: 100,
  sip_trunk_id: '00000000-0000-0000-0000-000000000001',
  fallback_sip_trunk_id: null,
  max_calls_per_minute: null,
  created_at: '2026-01-01T00:00:00Z',
};

const draftRoute = {
  id: 'r-2',
  name: 'US Domestic',
  status: 'draft',
  match_prefix: '+1',
  priority: 50,
  sip_trunk_id: '00000000-0000-0000-0000-000000000002',
  fallback_sip_trunk_id: null,
  max_calls_per_minute: 30,
  created_at: '2026-01-01T00:00:00Z',
};

const enterpriseCheck = {
  validation: {
    target_type: 'outbound_route' as const,
    target_id: 'r-1',
    target_name: 'International',
    validation_status: 'failed' as const,
    blocking_issues: [{ code: 'SITE_POLICY_BLOCKS_ROUTE', severity: 'error' as const, scope: 'calling_policy' as const, message: 'Site policy blocks international calls.' }],
    advisory_issues: [{ code: 'FAILOVER_SHARED_TRUNK_GROUP', severity: 'warning' as const, scope: 'trunk_group' as const, message: 'Primary and fallback trunks share a trunk group.' }],
    checked_at: '2026-06-07T00:00:00Z',
    summary: 'Route "International" has blocking enterprise conflicts.',
  },
  simulation: {
    target_type: 'outbound_route' as const,
    target_id: 'r-1',
    dial_string: '+442079460123',
    site_id: 'site-1',
    site_name: 'London',
    schedule_id: null,
    schedule_name: null,
    call_type: 'international',
    matched_rule_name: 'UK International',
    policy_name: 'No International',
    schedule_state: 'not_checked' as const,
    outcome: 'blocked_by_policy' as const,
    selected_trunk_id: null,
    selected_trunk_name: null,
    steps: [
      { category: 'site' as const, status: 'ok' as const, title: 'Site context', detail: 'Site "London" provides numbering and policy defaults for this simulation.' },
      { category: 'policy' as const, status: 'blocked' as const, title: 'Calling policy', detail: 'Policy "No International" blocks international calls for "+442079460123".' },
    ],
    summary: 'Route "International" would be blocked by policy "No International".',
    is_advisory: true as const,
    simulated_at: '2026-06-07T00:00:00Z',
  },
};

describe('OutboundRoutesPage', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
    vi.mocked(apiRequest).mockResolvedValue({ data: [activeRoute] });
  });

  it('renders the page heading', async () => {
    renderWithProviders(<OutboundRoutesPage />);
    expect(screen.getByText('Outbound Routes')).toBeInTheDocument();
  });

  it('shows loaded routes', async () => {
    renderWithProviders(<OutboundRoutesPage />);
    await waitFor(() => {
      expect(screen.getByText('International')).toBeInTheDocument();
    });
    expect(screen.getByText('+')).toBeInTheDocument();
  });

  it('shows Deactivate button for active route', async () => {
    renderWithProviders(<OutboundRoutesPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /deactivate international/i })).toBeInTheDocument();
    });
  });

  it('shows Publish button for draft route', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [draftRoute] });
    renderWithProviders(<OutboundRoutesPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /publish us domestic/i })).toBeInTheDocument();
    });
  });

  it('calls publish endpoint when Publish is clicked', async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({ data: [draftRoute] })
      .mockResolvedValueOnce({ data: { ...draftRoute, status: 'active' } })
      .mockResolvedValue({ data: [] });

    renderWithProviders(<OutboundRoutesPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /publish us domestic/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /publish us domestic/i }));
    await waitFor(() => {
      expect(vi.mocked(apiRequest)).toHaveBeenCalledWith(
        `/outbound-routes/${draftRoute.id}/publish`,
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('shows enterprise check panel with validation and simulation details', async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({ data: [activeRoute] })
      .mockResolvedValueOnce({ data: enterpriseCheck });

    renderWithProviders(<OutboundRoutesPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /analyze risk for international/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /analyze risk for international/i }));

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /enterprise check result/i })).toBeInTheDocument();
    });
    expect(screen.getByText('failed')).toBeInTheDocument();
    expect(screen.getByText('Site policy blocks international calls.')).toBeInTheDocument();
    expect(screen.getByText('Primary and fallback trunks share a trunk group.')).toBeInTheDocument();
    expect(screen.getByText('blocked_by_policy')).toBeInTheDocument();
    expect(screen.getByText('Policy "No International" blocks international calls for "+442079460123".')).toBeInTheDocument();
  });

  it('refreshes the enterprise check with the edited context', async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({ data: [activeRoute] })
      .mockResolvedValueOnce({ data: enterpriseCheck })
      .mockResolvedValueOnce({ data: enterpriseCheck });

    renderWithProviders(<OutboundRoutesPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /analyze risk for international/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /analyze risk for international/i }));
    await waitFor(() => expect(screen.getByRole('region', { name: /enterprise check result/i })).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/dial string/i), { target: { value: '+441234567890' } });
    fireEvent.change(screen.getByLabelText(/site id/i), { target: { value: 'site-1' } });
    fireEvent.click(screen.getByRole('button', { name: /refresh check/i }));

    await waitFor(() => {
      expect(vi.mocked(apiRequest)).toHaveBeenCalledWith(
        '/outbound-routes/r-1/enterprise-check',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            dial_string: '+441234567890',
            site_id: 'site-1',
            schedule_id: null,
          }),
        }),
      );
    });
  });

  it('shows loading state while enterprise check is fetching', async () => {
    let resolveCheck!: (value: unknown) => void;
    const pending = new Promise((resolve) => {
      resolveCheck = resolve;
    });
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({ data: [activeRoute] })
      .mockReturnValueOnce(pending as never);

    renderWithProviders(<OutboundRoutesPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /analyze risk for international/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /analyze risk for international/i }));

    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    expect(screen.getByText('Running enterprise check...')).toBeInTheDocument();
    resolveCheck({ data: enterpriseCheck });
  });

  it('closes the enterprise check panel', async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({ data: [activeRoute] })
      .mockResolvedValueOnce({ data: enterpriseCheck });

    renderWithProviders(<OutboundRoutesPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /analyze risk for international/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /analyze risk for international/i }));
    await waitFor(() => expect(screen.getByRole('region', { name: /enterprise check result/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /close enterprise check/i }));
    expect(screen.queryByRole('region', { name: /enterprise check result/i })).not.toBeInTheDocument();
  });

  it('shows enterprise check error state when API fails', async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({ data: [activeRoute] })
      .mockRejectedValue(new Error('Enterprise API error'));

    renderWithProviders(<OutboundRoutesPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /analyze risk for international/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /analyze risk for international/i }));

    await waitFor(() => expect(screen.getByText('Enterprise check failed')).toBeInTheDocument());
  });

  it('shows empty state when no routes', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [] });
    renderWithProviders(<OutboundRoutesPage />);
    await waitFor(() => {
      expect(screen.getByText('No outbound routes yet')).toBeInTheDocument();
    });
  });

  it('shows error state on fetch failure', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('Server error'));
    renderWithProviders(<OutboundRoutesPage />);
    await waitFor(() => {
      expect(screen.getByText('Could not load outbound routes')).toBeInTheDocument();
    });
  });
});
