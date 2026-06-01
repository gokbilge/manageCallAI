import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { IvrFlowDetailPage } from './ivr-flow-detail-page';

// Stub react-flow-renderer / ReactFlow since it requires a DOM canvas environment
vi.mock('./ivr-flow-builder', () => ({
  IvrFlowBuilder: () => <div data-testid="ivr-flow-builder">Builder stub</div>,
}));

vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: () => ({ session: { token: 'tok', claims: { role: 'tenant_admin', tenant_id: 't1' } } }),
}));

vi.mock('react-router-dom', async (imp) => {
  const actual = await imp<typeof import('react-router-dom')>();
  return { ...actual, useParams: () => ({ flowId: 'flow-1' }) };
});

vi.mock('@/lib/ivr-flows/ivr-flows-api', () => ({
  useIvrFlow: vi.fn(),
  useFlowVersions: vi.fn(),
  useFlowHistory: vi.fn(),
  useValidateCurrentDraft: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useSimulateCurrentDraft: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false, data: undefined })),
  usePublishFlowVersion: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useRollbackFlow: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUpdateFlowVersion: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useExtensionOptions: vi.fn(() => ({ data: [] })),
  usePromptAssetOptions: vi.fn(() => ({ data: [] })),
  useQueueOptions: vi.fn(() => ({ data: [] })),
  useVoicemailBoxOptions: vi.fn(() => ({ data: [] })),
  useScheduleOptions: vi.fn(() => ({ data: [] })),
}));

vi.mock('@/features/ivr-builder/hooks/use-builder-capability', () => ({
  useBuilderCapability: () => ({
    canEdit: true, canValidate: true, canSimulate: true, canPublish: true, canRollback: true,
  }),
}));

import { useIvrFlow, useFlowVersions, useFlowHistory } from '@/lib/ivr-flows/ivr-flows-api';

const baseFlow = {
  id: 'flow-1',
  name: 'Main IVR',
  description: 'Primary auto-attendant',
  status: 'active' as const,
  draft_version_id: 'v1',
  active_version_id: 'v1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const baseVersion = {
  id: 'v1',
  flow_id: 'flow-1',
  version_number: 1,
  state: 'published' as const,
  graph_json: { entry_node_id: 'start', nodes: [{ id: 'start', type: 'hangup', data: {} }] },
  created_at: '2026-01-01T00:00:00Z',
  validated_at: null,
  simulated_at: null,
  published_at: '2026-01-01T00:00:00Z',
};

describe('IvrFlowDetailPage', () => {
  afterEach(() => vi.clearAllMocks());

  it('shows loading state while flow is fetching', () => {
    vi.mocked(useIvrFlow).mockReturnValue({ isLoading: true, data: undefined, isError: false } as never);
    vi.mocked(useFlowVersions).mockReturnValue({ data: [], isLoading: true } as never);
    vi.mocked(useFlowHistory).mockReturnValue({ data: undefined, isLoading: false } as never);
    renderWithProviders(<IvrFlowDetailPage />);
    expect(screen.getByText('Loading flow...')).toBeInTheDocument();
  });

  it('renders flow name after load', async () => {
    vi.mocked(useIvrFlow).mockReturnValue({ isLoading: false, isError: false, data: baseFlow } as never);
    vi.mocked(useFlowVersions).mockReturnValue({ data: [baseVersion], isLoading: false } as never);
    vi.mocked(useFlowHistory).mockReturnValue({ data: undefined, isLoading: false } as never);
    renderWithProviders(<IvrFlowDetailPage />);
    await waitFor(() => {
      expect(screen.getAllByText('Main IVR').length).toBeGreaterThan(0);
    });
  });

  it('shows flow not found when data is null after load', async () => {
    vi.mocked(useIvrFlow).mockReturnValue({ isLoading: false, isError: false, data: null } as never);
    vi.mocked(useFlowVersions).mockReturnValue({ data: [], isLoading: false } as never);
    vi.mocked(useFlowHistory).mockReturnValue({ data: undefined, isLoading: false } as never);
    renderWithProviders(<IvrFlowDetailPage />);
    await waitFor(() => {
      expect(screen.getByText('Flow not found.')).toBeInTheDocument();
    });
  });

  it('renders the IVR flow builder stub', async () => {
    vi.mocked(useIvrFlow).mockReturnValue({ isLoading: false, isError: false, data: baseFlow } as never);
    vi.mocked(useFlowVersions).mockReturnValue({ data: [baseVersion] } as never);
    vi.mocked(useFlowHistory).mockReturnValue({ data: undefined } as never);
    renderWithProviders(<IvrFlowDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId('ivr-flow-builder')).toBeInTheDocument();
    });
  });
});
