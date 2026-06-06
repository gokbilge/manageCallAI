import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { IvrFlowDetailPage } from './ivr-flow-detail-page';

const mocks = vi.hoisted(() => ({
  caps: {
    canEdit: true,
    canValidate: true,
    canSimulate: true,
    canPublish: true,
    canRollback: true,
  },
  validateDraft: vi.fn(),
  simulateDraft: vi.fn(),
  rollbackFlow: vi.fn(),
  publishDraft: vi.fn(),
  updateVersion: vi.fn(),
}));

vi.mock('./ivr-flow-builder', () => ({
  IvrFlowBuilder: ({
    onSave,
    readOnly,
    readOnlyReason,
  }: {
    onSave: (graph_json: Record<string, unknown>) => Promise<void>;
    readOnly?: boolean;
    readOnlyReason?: string;
  }) => (
    <div data-readonly={readOnly ? 'true' : 'false'} data-testid="ivr-flow-builder">
      <span>{readOnlyReason ?? 'editable'}</span>
      <button onClick={() => void onSave({ entry_node_id: 'start', nodes: [] })} type="button">
        Save via builder
      </button>
    </div>
  ),
}));

vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: () => ({ session: { token: 'tok', claims: { role: 'tenant_admin', tenant_id: 't1' } } }),
}));

vi.mock('react-router-dom', async (imp) => {
  const actual = await imp<typeof import('react-router-dom')>();
  return { ...actual, useParams: () => ({ flowId: 'flow-1' }) };
});

vi.mock('@/features/ivr-builder/hooks/use-builder-capability', () => ({
  useBuilderCapability: () => mocks.caps,
}));

vi.mock('@/lib/ivr-flows/ivr-flows-api', () => ({
  useIvrFlow: vi.fn(),
  useFlowVersions: vi.fn(),
  useFlowHistory: vi.fn(),
  useValidateCurrentDraft: vi.fn(() => ({ mutateAsync: mocks.validateDraft, isPending: false, data: undefined })),
  useSimulateCurrentDraft: vi.fn(() => ({ mutateAsync: mocks.simulateDraft, isPending: false, data: undefined })),
  usePublishFlowVersion: vi.fn(() => ({ mutateAsync: mocks.publishDraft, isPending: false, data: undefined })),
  useRollbackFlow: vi.fn(() => ({ mutateAsync: mocks.rollbackFlow, isPending: false, data: undefined })),
  useUpdateFlowVersion: vi.fn(() => ({ mutateAsync: mocks.updateVersion, isPending: false })),
  useExtensionOptions: vi.fn(() => ({ data: [], isLoading: false, isError: false })),
  usePromptAssetOptions: vi.fn(() => ({ data: [], isLoading: false, isError: false })),
  useQueueOptions: vi.fn(() => ({ data: [], isLoading: false, isError: false })),
  useVoicemailBoxOptions: vi.fn(() => ({ data: [], isLoading: false, isError: false })),
  useScheduleOptions: vi.fn(() => ({ data: [], isLoading: false, isError: false })),
}));

import {
  useExtensionOptions,
  useFlowHistory,
  useFlowVersions,
  useIvrFlow,
  usePromptAssetOptions,
  useQueueOptions,
  useScheduleOptions,
  useVoicemailBoxOptions,
} from '@/lib/ivr-flows/ivr-flows-api';

const baseFlow = {
  id: 'flow-1',
  name: 'Main IVR',
  description: 'Primary auto-attendant',
  status: 'draft' as const,
  draft_version_id: 'v1',
  active_version_id: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const baseVersion = {
  id: 'v1',
  flow_id: 'flow-1',
  version_number: 1,
  state: 'draft' as const,
  graph_json: { entry_node_id: 'start', nodes: [{ id: 'start', type: 'hangup', data: {} }] },
  created_at: '2026-01-01T00:00:00Z',
  validated_at: null,
  simulated_at: null,
  published_at: null,
};

function mockLoadedPage(overrides?: { flow?: unknown; versions?: unknown[]; history?: unknown }) {
  const flow = overrides && Object.prototype.hasOwnProperty.call(overrides, 'flow') ? overrides.flow : baseFlow;
  vi.mocked(useIvrFlow).mockReturnValue({
    data: flow,
    error: undefined,
    isError: false,
    isLoading: false,
    refetch: vi.fn(),
  } as never);
  vi.mocked(useFlowVersions).mockReturnValue({
    data: overrides?.versions ?? [baseVersion],
    error: undefined,
    isError: false,
    isLoading: false,
    refetch: vi.fn(),
  } as never);
  vi.mocked(useFlowHistory).mockReturnValue({
    data: overrides?.history,
    error: undefined,
    isError: false,
    isLoading: false,
    refetch: vi.fn(),
  } as never);
}

describe('IvrFlowDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.caps.canEdit = true;
    mocks.caps.canValidate = true;
    mocks.caps.canSimulate = true;
    mocks.caps.canPublish = true;
    mocks.caps.canRollback = true;
    mocks.simulateDraft.mockResolvedValue({ outcome: { path: ['start', 'sales'], status: 'passed', errors: [] } });
    mocks.rollbackFlow.mockResolvedValue({ status: 'published' });
    vi.mocked(useExtensionOptions).mockReturnValue({ data: [], isLoading: false, isError: false } as never);
    vi.mocked(usePromptAssetOptions).mockReturnValue({ data: [], isLoading: false, isError: false } as never);
    vi.mocked(useQueueOptions).mockReturnValue({ data: [], isLoading: false, isError: false } as never);
    vi.mocked(useVoicemailBoxOptions).mockReturnValue({ data: [], isLoading: false, isError: false } as never);
    vi.mocked(useScheduleOptions).mockReturnValue({ data: [], isLoading: false, isError: false } as never);
  });

  it('shows loading state while flow is fetching', () => {
    vi.mocked(useIvrFlow).mockReturnValue({ isLoading: true, data: undefined, isError: false } as never);
    vi.mocked(useFlowVersions).mockReturnValue({ data: [], isLoading: true } as never);
    vi.mocked(useFlowHistory).mockReturnValue({ data: undefined, isLoading: false } as never);
    renderWithProviders(<IvrFlowDetailPage />);
    expect(screen.getByText('Loading flow...')).toBeInTheDocument();
  });

  it('renders flow name after load', async () => {
    mockLoadedPage();
    renderWithProviders(<IvrFlowDetailPage />);
    await waitFor(() => expect(screen.getAllByText('Main IVR').length).toBeGreaterThan(0));
  });

  it('shows flow not found when data is null after load', async () => {
    mockLoadedPage({ flow: null, versions: [] });
    renderWithProviders(<IvrFlowDetailPage />);
    await waitFor(() => expect(screen.getByText('Flow not found.')).toBeInTheDocument());
  });

  it('renders the builder editable for a draft version', async () => {
    mockLoadedPage();
    renderWithProviders(<IvrFlowDetailPage />);
    await waitFor(() => expect(screen.getByTestId('ivr-flow-builder')).toHaveAttribute('data-readonly', 'false'));
  });

  it('saves graph edits through the current draft version mutation', async () => {
    mockLoadedPage();
    renderWithProviders(<IvrFlowDetailPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Save via builder' }));
    await waitFor(() => {
      expect(mocks.updateVersion).toHaveBeenCalledWith({
        versionId: 'v1',
        graph_json: { entry_node_id: 'start', nodes: [] },
      });
    });
  });

  it('calls the route-level validate draft mutation', () => {
    mockLoadedPage();
    renderWithProviders(<IvrFlowDetailPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Validate Draft' }));
    expect(mocks.validateDraft).toHaveBeenCalledTimes(1);
  });

  it('calls publish with the selected draft version id', () => {
    mockLoadedPage({ versions: [{ ...baseVersion, state: 'validated', validated_at: '2026-01-01T00:00:00Z' }] });
    renderWithProviders(<IvrFlowDetailPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Publish Draft' }));
    expect(mocks.publishDraft).toHaveBeenCalledWith('v1');
  });

  it('marks the builder read-only when the role cannot edit', async () => {
    mocks.caps.canEdit = false;
    mockLoadedPage();
    renderWithProviders(<IvrFlowDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId('ivr-flow-builder')).toHaveAttribute('data-readonly', 'true');
      expect(screen.getByText('Your role can view this flow, but cannot edit draft graph state.')).toBeInTheDocument();
    });
  });

  it('marks the builder read-only for a published version', async () => {
    mockLoadedPage({
      flow: { ...baseFlow, draft_version_id: null, active_version_id: 'v1', status: 'active' },
      versions: [{ ...baseVersion, state: 'published', published_at: '2026-01-01T00:00:00Z' }],
    });
    renderWithProviders(<IvrFlowDetailPage />);
    await waitFor(() => {
      expect(screen.getByTestId('ivr-flow-builder')).toHaveAttribute('data-readonly', 'true');
      expect(screen.getByText('Version 1 is published; create or restore a draft before editing.')).toBeInTheDocument();
    });
  });

  it('shows a stable empty builder state when no version exists', async () => {
    mockLoadedPage({ flow: { ...baseFlow, draft_version_id: null }, versions: [] });
    renderWithProviders(<IvrFlowDetailPage />);
    expect(await screen.findByText('No draft version available yet. Create or restore a draft before editing visually.')).toBeInTheDocument();
  });

  it('renders validation, simulation, publish, and audit history entries', async () => {
    mockLoadedPage({
      history: {
        validations: [{ id: 'val-1', status: 'passed', created_at: '2026-01-01T00:00:00Z', version_id: 'v1' }],
        simulations: [{ id: 'sim-1', status: 'passed', created_at: '2026-01-01T00:01:00Z', version_id: 'v1' }],
        publishes: [{
          id: 'pub-1',
          action_type: 'publish',
          result: 'success',
          created_at: '2026-01-01T00:02:00Z',
          version_id: 'v1',
          approval_status: 'approved',
        }],
        audits: [{ id: 'audit-1', action: 'ivr.publish', created_at: '2026-01-01T00:03:00Z', actor_id: null, actor_type: 'system' }],
      },
    });

    renderWithProviders(<IvrFlowDetailPage />);

    expect(await screen.findByText('Validation Runs')).toBeInTheDocument();
    expect(screen.getByText(/publish .* success/i)).toBeInTheDocument();
    expect(screen.getByText(/approval: approved/i)).toBeInTheDocument();
    expect(screen.getByText(/ivr.publish/)).toBeInTheDocument();
    expect(screen.getByText('system')).toBeInTheDocument();
  });

  it('runs a simulation with the default scenario', async () => {
    mockLoadedPage();
    renderWithProviders(<IvrFlowDetailPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Run Simulation' }));

    await waitFor(() => {
      expect(mocks.simulateDraft).toHaveBeenCalledWith(expect.objectContaining({
        digits: ['1'],
        caller_number: '+905551112233',
        force_timeout: undefined,
        force_invalid: undefined,
      }));
    });
  });

  it('calls rollback when an active version exists', () => {
    mockLoadedPage({ flow: { ...baseFlow, active_version_id: 'v0' } });
    renderWithProviders(<IvrFlowDetailPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Rollback' }));

    expect(mocks.rollbackFlow).toHaveBeenCalledTimes(1);
  });

  it('shows builder dependency errors before rendering the builder', async () => {
    mockLoadedPage();
    vi.mocked(usePromptAssetOptions).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('prompt options failed'),
    } as never);

    renderWithProviders(<IvrFlowDetailPage />);

    expect(await screen.findByText('prompt options failed')).toBeInTheDocument();
  });
});
