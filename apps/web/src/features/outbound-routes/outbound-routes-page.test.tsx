import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('OutboundRoutesPage', () => {
  beforeEach(() => {
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

  it('shows rate cap when max_calls_per_minute is set', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [draftRoute] });
    renderWithProviders(<OutboundRoutesPage />);
    await waitFor(() => {
      expect(screen.getByText('30/min')).toBeInTheDocument();
    });
  });

  it('shows Risk button for each route', async () => {
    renderWithProviders(<OutboundRoutesPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /analyze risk for international/i })).toBeInTheDocument();
    });
  });

  it('shows risk analysis panel with low risk after clicking Risk button', async () => {
    const riskResult = {
      target_type: 'outbound_route',
      target_id: 'r-1',
      target_name: 'International',
      target_status: 'active',
      risk_level: 'low',
      affected_objects: [{ type: 'sip_trunk', id: '00000000-0000-0000-0000-000000000001', name: 'Carrier A', role: 'primary_trunk' }],
      unresolved_concerns: [],
      summary: 'Route "International" is ready.',
      is_advisory: true,
      analyzed_at: '2026-06-05T00:00:00Z',
    };
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({ data: [activeRoute] })
      .mockResolvedValue({ data: riskResult });

    renderWithProviders(<OutboundRoutesPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /analyze risk for international/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /analyze risk for international/i }));

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /risk analysis result/i })).toBeInTheDocument();
    });
    expect(screen.getByText('low')).toBeInTheDocument();
    expect(screen.getByText('No concerns found — route looks good to publish.')).toBeInTheDocument();
    expect(screen.getByText('primary_trunk')).toBeInTheDocument();
    expect(screen.getByText('Advisory only — this analysis does not publish or modify any route.')).toBeInTheDocument();
  });

  it('shows risk concerns in analysis panel', async () => {
    const riskResult = {
      target_type: 'outbound_route',
      target_id: 'r-1',
      target_name: 'International',
      target_status: 'active',
      risk_level: 'high',
      affected_objects: [],
      unresolved_concerns: [{ code: 'TRUNK_INACTIVE', severity: 'error', message: 'Primary SIP trunk is inactive.' }],
      summary: 'Route has 1 blocking concern.',
      is_advisory: true,
      analyzed_at: '2026-06-05T00:00:00Z',
    };
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({ data: [activeRoute] })
      .mockResolvedValue({ data: riskResult });

    renderWithProviders(<OutboundRoutesPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /analyze risk for international/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /analyze risk for international/i }));

    await waitFor(() => expect(screen.getByText('high')).toBeInTheDocument());
    expect(screen.getByText('Primary SIP trunk is inactive.')).toBeInTheDocument();
  });

  it('closes risk analysis panel when close button is clicked', async () => {
    const riskResult = {
      target_type: 'outbound_route', target_id: 'r-1', target_name: 'International',
      target_status: 'active', risk_level: 'low', affected_objects: [],
      unresolved_concerns: [], summary: 'OK.', is_advisory: true, analyzed_at: '2026-06-05T00:00:00Z',
    };
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({ data: [activeRoute] })
      .mockResolvedValue({ data: riskResult });

    renderWithProviders(<OutboundRoutesPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /analyze risk for international/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /analyze risk for international/i }));
    await waitFor(() => expect(screen.getByRole('region', { name: /risk analysis result/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /close risk analysis/i }));
    expect(screen.queryByRole('region', { name: /risk analysis result/i })).not.toBeInTheDocument();
  });

  it('shows risk analysis error state when API fails', async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({ data: [activeRoute] })
      .mockRejectedValue(new Error('Risk API error'));

    renderWithProviders(<OutboundRoutesPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /analyze risk for international/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /analyze risk for international/i }));

    await waitFor(() => expect(screen.getByText('Risk analysis failed')).toBeInTheDocument());
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
