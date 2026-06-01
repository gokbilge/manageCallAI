import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders as render } from '@/test/render';
import { CompliancePage } from './compliance-page';

vi.mock('@/lib/compliance/compliance-api', () => ({
  useRetentionPolicy: vi.fn(),
  useUpdateRetentionPolicy: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useLegalHolds: vi.fn(),
  useCreateLegalHold: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useReleaseLegalHold: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

vi.mock('@tanstack/react-query', async (imp) => {
  const actual = await imp<typeof import('@tanstack/react-query')>();
  return { ...actual, useMutation: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })) };
});

import { useRetentionPolicy, useLegalHolds } from '@/lib/compliance/compliance-api';

const basePolicy = {
  id: 'policy-1',
  tenant_id: 't1',
  recording_retention_days: 90,
  transcript_retention_days: 180,
  cdr_retention_days: 365,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const baseHold = {
  id: 'hold-1',
  tenant_id: 't1',
  resource_type: 'recording' as const,
  resource_id: null,
  initiated_by: 'user-1',
  case_reference: 'CASE-001',
  reason: 'Regulatory requirement',
  status: 'active' as const,
  released_by: null,
  released_at: null,
  expires_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('CompliancePage', () => {
  it('shows loading state while policy is fetching', () => {
    vi.mocked(useRetentionPolicy).mockReturnValue({ isLoading: true, isError: false, data: undefined } as never);
    vi.mocked(useLegalHolds).mockReturnValue({ isLoading: true, isError: false, data: undefined } as never);
    render(<CompliancePage />);
    expect(screen.getByText(/loading policy/i)).toBeInTheDocument();
  });

  it('shows current retention policy values', () => {
    vi.mocked(useRetentionPolicy).mockReturnValue({ isLoading: false, isError: false, data: basePolicy } as never);
    vi.mocked(useLegalHolds).mockReturnValue({ isLoading: false, isError: false, data: [] } as never);
    render(<CompliancePage />);
    expect(screen.getByText('90 days')).toBeInTheDocument();
    expect(screen.getByText('180 days')).toBeInTheDocument();
    expect(screen.getByText('365 days')).toBeInTheDocument();
  });

  it('shows indefinite retention when days is null', () => {
    vi.mocked(useRetentionPolicy).mockReturnValue({
      isLoading: false, isError: false,
      data: { ...basePolicy, recording_retention_days: null },
    } as never);
    vi.mocked(useLegalHolds).mockReturnValue({ isLoading: false, isError: false, data: [] } as never);
    render(<CompliancePage />);
    expect(screen.getByText('Indefinite (keep forever)')).toBeInTheDocument();
  });

  it('shows an active legal hold', () => {
    vi.mocked(useRetentionPolicy).mockReturnValue({ isLoading: false, isError: false, data: basePolicy } as never);
    vi.mocked(useLegalHolds).mockReturnValue({ isLoading: false, isError: false, data: [baseHold] } as never);
    render(<CompliancePage />);
    expect(screen.getByText('CASE-001')).toBeInTheDocument();
    expect(screen.getByLabelText(/release hold/i)).toBeInTheDocument();
  });

  it('shows empty state when no legal holds exist', () => {
    vi.mocked(useRetentionPolicy).mockReturnValue({ isLoading: false, isError: false, data: basePolicy } as never);
    vi.mocked(useLegalHolds).mockReturnValue({ isLoading: false, isError: false, data: [] } as never);
    render(<CompliancePage />);
    expect(screen.getByText(/no active holds/i)).toBeInTheDocument();
  });

  it('shows error state when retention policy fails', () => {
    vi.mocked(useRetentionPolicy).mockReturnValue({ isLoading: false, isError: true, data: undefined, error: new Error('fail') } as never);
    vi.mocked(useLegalHolds).mockReturnValue({ isLoading: false, isError: false, data: [] } as never);
    render(<CompliancePage />);
    expect(screen.getByText(/could not load retention policy/i)).toBeInTheDocument();
  });
});
