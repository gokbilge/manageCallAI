import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders as render } from '@/test/render';
import { CompliancePage } from './compliance-page';

const mutations = vi.hoisted(() => ({
  updateRetentionPolicy: vi.fn(),
  createLegalHold: vi.fn(),
  releaseLegalHold: vi.fn(),
}));

vi.mock('@/lib/compliance/compliance-api', () => ({
  useRetentionPolicy: vi.fn(),
  useUpdateRetentionPolicy: vi.fn(() => ({ mutateAsync: mutations.updateRetentionPolicy, isPending: false })),
  useLegalHolds: vi.fn(),
  useCreateLegalHold: vi.fn(() => ({ mutateAsync: mutations.createLegalHold, isPending: false })),
  useReleaseLegalHold: vi.fn(() => ({ mutateAsync: mutations.releaseLegalHold, isPending: false })),
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
  voicemail_retention_days: 90,
  transcript_retention_days: 180,
  ai_summary_retention_days: 180,
  cdr_retention_days: 365,
  call_event_retention_days: 365,
  generated_media_retention_days: 180,
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
  beforeEach(() => {
    vi.clearAllMocks();
    mutations.updateRetentionPolicy.mockResolvedValue(basePolicy);
    mutations.createLegalHold.mockResolvedValue(baseHold);
    mutations.releaseLegalHold.mockResolvedValue({ ...baseHold, status: 'released' });
  });

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
    expect(screen.getAllByText('90 days')).toHaveLength(2);
    expect(screen.getAllByText('180 days')).toHaveLength(3);
    expect(screen.getAllByText('365 days')).toHaveLength(2);
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

  it('submits retention policy updates with numeric and indefinite values', async () => {
    vi.mocked(useRetentionPolicy).mockReturnValue({ isLoading: false, isError: false, data: basePolicy } as never);
    vi.mocked(useLegalHolds).mockReturnValue({ isLoading: false, isError: false, data: [] } as never);
    render(<CompliancePage />);

    const inputs = screen.getAllByPlaceholderText('Leave empty for indefinite');
    fireEvent.change(inputs[0]!, { target: { value: '30' } });
    fireEvent.change(inputs[1]!, { target: { value: '' } });
    fireEvent.change(inputs[4]!, { target: { value: '365' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Policy' }));

    await waitFor(() => expect(mutations.updateRetentionPolicy).toHaveBeenCalledWith({
      recording_retention_days: 30,
      voicemail_retention_days: null,
      transcript_retention_days: null,
      ai_summary_retention_days: null,
      cdr_retention_days: 365,
      call_event_retention_days: null,
      generated_media_retention_days: null,
    }));
  });

  it('creates and releases legal holds through the page actions', async () => {
    vi.mocked(useRetentionPolicy).mockReturnValue({ isLoading: false, isError: false, data: basePolicy } as never);
    vi.mocked(useLegalHolds).mockReturnValue({ isLoading: false, isError: false, data: [baseHold] } as never);
    render(<CompliancePage />);

    fireEvent.click(screen.getByRole('button', { name: '+ New Hold' }));
    fireEvent.change(screen.getByPlaceholderText('CASE-001 (optional)'), { target: { value: 'CASE-999' } });
    fireEvent.change(screen.getByPlaceholderText(/regulatory hold/i), { target: { value: 'Preserve call records' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Hold' }));

    await waitFor(() => expect(mutations.createLegalHold).toHaveBeenCalledWith(expect.objectContaining({
      resource_type: 'recording',
      case_reference: 'CASE-999',
      reason: 'Preserve call records',
    })));

    fireEvent.click(screen.getByLabelText(/release hold/i));

    await waitFor(() => expect(mutations.releaseLegalHold).toHaveBeenCalledWith('hold-1'));
  });
});
