import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ApprovalsPage } from './approvals-page';
import { renderWithProviders } from '@/test/render';
import { ApiError, apiRequest } from '@/lib/api/client';

vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: () => ({
    session: {
      token: 'token',
      claims: { tenant_id: 'tenant-1' },
    },
  }),
}));

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiRequest: vi.fn() };
});

function mockBothQueries(approvals: unknown[], policies: unknown[] = []) {
  vi.mocked(apiRequest).mockImplementation(async (path: string) => {
    if (String(path).includes('approvals')) return { data: approvals };
    return { data: policies };
  });
}

const pendingApproval = {
  id: 'req-1',
  tenant_id: 'tenant-1',
  object_type: 'ivr_flow',
  object_id: 'flow-1',
  version_id: 'ver-1',
  requested_by: 'user-abc',
  status: 'pending',
  created_at: '2026-05-28T10:00:00.000Z',
  metadata: {},
  flow_name: 'Main IVR',
  action_type: 'publish',
};

const activePolicy = {
  id: 'pol-1',
  tenant_id: 'tenant-1',
  policy_type: 'ivr_publish_control',
  status: 'active',
  rules: { require_approval: true },
  created_at: '2026-05-01T00:00:00.000Z',
};

describe('ApprovalsPage', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  it('renders loading then empty state when no approvals exist', async () => {
    mockBothQueries([]);

    renderWithProviders(<ApprovalsPage />);

    expect(screen.getByText('Loading approvals...')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('No pending approvals')).toBeInTheDocument();
    });
  });

  it('renders approval rows with flow name and action type', async () => {
    mockBothQueries([pendingApproval]);

    renderWithProviders(<ApprovalsPage />);

    await waitFor(() => {
      expect(screen.getByText('Main IVR')).toBeInTheDocument();
      expect(screen.getByText('Publish')).toBeInTheDocument();
      expect(screen.getByText('user-abc')).toBeInTheDocument();
    });
  });

  it('renders error state when approvals API call fails', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new ApiError('Unauthorized', 401));

    renderWithProviders(<ApprovalsPage />);

    await waitFor(() => {
      expect(screen.getByText('Could not load approval requests')).toBeInTheDocument();
    });
  });

  it('renders active policies panel', async () => {
    mockBothQueries([], [activePolicy]);

    renderWithProviders(<ApprovalsPage />);

    await waitFor(() => {
      expect(screen.getByText('ivr_publish_control')).toBeInTheDocument();
    });
  });

  it('shows rollback badge for rollback action type', async () => {
    mockBothQueries([{ ...pendingApproval, action_type: 'rollback' }]);

    renderWithProviders(<ApprovalsPage />);

    await waitFor(() => {
      expect(screen.getByText('Rollback')).toBeInTheDocument();
    });
  });

  it('approve and reject buttons are present', async () => {
    mockBothQueries([pendingApproval]);
    renderWithProviders(<ApprovalsPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
    });
  });

  it('shows AI origin and provider context for AI-suggested approvals', async () => {
    mockBothQueries([{
      ...pendingApproval,
      metadata: {
        ai_lineage: {
          ai_assisted: true,
          provider: 'openai',
          model: 'gpt-5',
          risk_level: 'high',
          risk_summary: 'affects main DID',
        },
      },
    }]);

    renderWithProviders(<ApprovalsPage />);

    await waitFor(() => {
      expect(screen.getByText('AI Suggested')).toBeInTheDocument();
      expect(screen.getByText('openai / gpt-5')).toBeInTheDocument();
      expect(screen.getByText('high - affects main DID')).toBeInTheDocument();
    });
  });

  it('shows mutation error alert when approve throws', async () => {
    // Queries succeed; the mutation (POST to approve) throws.
    vi.mocked(apiRequest).mockImplementation(async (path: string, opts?: unknown) => {
      const method = (opts as { method?: string } | undefined)?.method ?? 'GET';
      if (method === 'GET' || !opts) {
        if (String(path).includes('approvals')) return { data: [pendingApproval] };
        return { data: [] };
      }
      throw new ApiError('Decision failed: server error', 500);
    });

    renderWithProviders(<ApprovalsPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument());
    screen.getByRole('button', { name: 'Approve' }).click();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
