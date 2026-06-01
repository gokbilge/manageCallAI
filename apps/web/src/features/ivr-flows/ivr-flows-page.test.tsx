import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { IvrFlowsPage } from './ivr-flows-page';

vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: () => ({ session: { token: 'tok', claims: { role: 'tenant_admin', tenant_id: 't1' } } }),
}));
vi.mock('@/lib/ivr-flows/ivr-flows-api', () => ({
  useIvrFlows: vi.fn(),
  useCreateIvrFlow: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));
vi.mock('@tanstack/react-query', async (imp) => {
  const actual = await imp<typeof import('@tanstack/react-query')>();
  return { ...actual, useMutation: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })) };
});

import { useIvrFlows } from '@/lib/ivr-flows/ivr-flows-api';

const baseFlow = {
  id: 'flow-1',
  name: 'Main IVR',
  description: 'Primary auto-attendant',
  status: 'active' as const,
  draft_version_id: null,
  active_version_id: 'v1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('IvrFlowsPage', () => {
  afterEach(() => vi.clearAllMocks());

  it('renders page title', () => {
    vi.mocked(useIvrFlows).mockReturnValue({ isLoading: true, isError: false, data: undefined } as never);
    renderWithProviders(<IvrFlowsPage />);
    expect(screen.getByText('IVR Flows')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    vi.mocked(useIvrFlows).mockReturnValue({ isLoading: true, isError: false, data: undefined } as never);
    renderWithProviders(<IvrFlowsPage />);
    expect(screen.getByText(/Loading IVR flows/i)).toBeInTheDocument();
  });

  it('renders flow list after data loads', async () => {
    vi.mocked(useIvrFlows).mockReturnValue({ isLoading: false, isError: false, data: [baseFlow] } as never);
    renderWithProviders(<IvrFlowsPage />);
    await waitFor(() => {
      expect(screen.getByText('Main IVR')).toBeInTheDocument();
    });
  });

  it('shows empty state when no flows', async () => {
    vi.mocked(useIvrFlows).mockReturnValue({ isLoading: false, isError: false, data: [] } as never);
    renderWithProviders(<IvrFlowsPage />);
    await waitFor(() => {
      expect(screen.getByText(/No IVR flows/i)).toBeInTheDocument();
    });
  });

  it('shows error state when fetch fails', async () => {
    vi.mocked(useIvrFlows).mockReturnValue({ isLoading: false, isError: true, data: undefined, error: new Error('err') } as never);
    renderWithProviders(<IvrFlowsPage />);
    await waitFor(() => {
      expect(screen.getByText(/Could not load/i)).toBeInTheDocument();
    });
  });

  it('renders the create flow form label', () => {
    vi.mocked(useIvrFlows).mockReturnValue({ isLoading: false, isError: false, data: [] } as never);
    renderWithProviders(<IvrFlowsPage />);
    expect(screen.getByText('Flow name')).toBeInTheDocument();
    expect(screen.getAllByText('Create IVR Flow').length).toBeGreaterThan(0);
  });
});
