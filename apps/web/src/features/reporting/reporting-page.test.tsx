import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { ReportingPage } from './reporting-page';
import { apiRequest, ApiError } from '@/lib/api/client';

vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: () => ({
    session: { token: 'test-token', claims: { tenant_id: 'tenant-1' } },
  }),
}));

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiRequest: vi.fn() };
});

const successResult = {
  question: 'show failed calls today',
  applied_filters: [
    { dimension: 'status', value: 'failed' },
    { dimension: 'time_range', value: 'today' },
  ],
  explanation: 'Showing calls (all directions), with status: failed, today.',
  result_count: 2,
  results: [
    { call_id: 'call-uuid-001', event_type: 'outbound_call_failed', event_time: '2026-06-05T10:00:00Z', source: 'freeswitch' },
    { call_id: 'call-uuid-002', event_type: 'outbound_call_failed', event_time: '2026-06-05T09:30:00Z', source: 'freeswitch' },
  ],
  is_advisory: true,
  queried_at: '2026-06-05T11:00:00Z',
};

const countResult = {
  question: 'how many outbound calls',
  applied_filters: [
    { dimension: 'direction', value: 'outbound' },
    { dimension: 'aggregation', value: 'count' },
  ],
  explanation: 'Showing outbound calls, in the last 24 hours (default window). Found 5 matching event(s).',
  result_count: 5,
  results: [],
  is_advisory: true,
  queried_at: '2026-06-05T11:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ReportingPage', () => {
  it('renders the page heading and question input', () => {
    renderWithProviders(<ReportingPage />);
    expect(screen.getByText('Natural-Language Reporting')).toBeInTheDocument();
    expect(screen.getByLabelText('Reporting question')).toBeInTheDocument();
  });

  it('shows example questions as clickable chips', () => {
    renderWithProviders(<ReportingPage />);
    expect(screen.getByLabelText(/example: show failed calls today/i)).toBeInTheDocument();
  });

  it('runs query when Run button clicked', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: successResult });
    renderWithProviders(<ReportingPage />);
    fireEvent.change(screen.getByLabelText('Reporting question'), { target: { value: 'show failed calls today' } });
    fireEvent.click(screen.getByRole('button', { name: /run query/i }));
    await waitFor(() => {
      expect(vi.mocked(apiRequest)).toHaveBeenCalledWith('/reporting/nl-query', expect.objectContaining({ method: 'POST' }));
    });
  });

  it('runs query when Enter pressed in input', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: successResult });
    renderWithProviders(<ReportingPage />);
    const input = screen.getByLabelText('Reporting question');
    fireEvent.change(input, { target: { value: 'show failed calls today' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(vi.mocked(apiRequest)).toHaveBeenCalled());
  });

  it('runs query when example chip clicked', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: successResult });
    renderWithProviders(<ReportingPage />);
    fireEvent.click(screen.getByLabelText(/example: show failed calls today/i));
    await waitFor(() => expect(vi.mocked(apiRequest)).toHaveBeenCalled());
  });

  it('shows results table on success with list results', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: successResult });
    renderWithProviders(<ReportingPage />);
    fireEvent.click(screen.getByLabelText(/example: show failed calls today/i));
    await waitFor(() => {
      expect(screen.getAllByText('outbound_call_failed').length).toBeGreaterThan(0);
    });
    expect(screen.getByText('matching event(s)')).toBeInTheDocument();
    expect(screen.getByText(/Advisory only — results are read-only/)).toBeInTheDocument();
  });

  it('shows applied filter chips', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: successResult });
    renderWithProviders(<ReportingPage />);
    fireEvent.click(screen.getByLabelText(/example: show failed calls today/i));
    await waitFor(() => expect(screen.getByText('failed')).toBeInTheDocument());
    expect(screen.getByText('today')).toBeInTheDocument();
  });

  it('shows no-results message when results array is empty', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: countResult });
    renderWithProviders(<ReportingPage />);
    fireEvent.click(screen.getByLabelText(/example: show failed calls today/i));
    // count is in a <span>; wait for the adjacent "matching event(s)" label to appear
    await waitFor(() => {
      expect(screen.getByText('matching event(s)')).toBeInTheDocument();
    });
    expect(screen.getByText('No matching events found for this query.')).toBeInTheDocument();
  });

  it('shows default-filter message when no filters applied', async () => {
    const noFilterResult = { ...successResult, applied_filters: [], results: [], result_count: 0 };
    vi.mocked(apiRequest).mockResolvedValue({ data: noFilterResult });
    renderWithProviders(<ReportingPage />);
    fireEvent.click(screen.getByLabelText(/example: show failed calls today/i));
    await waitFor(() => {
      expect(screen.getByText('none (default 24h window)')).toBeInTheDocument();
    });
  });

  it('shows unsupported-question warning on 400 error', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new ApiError('Question not recognized as a supported call reporting query.', 400));
    renderWithProviders(<ReportingPage />);
    fireEvent.click(screen.getByLabelText(/example: show failed calls today/i));
    await waitFor(() => {
      expect(screen.getByText('Question not supported')).toBeInTheDocument();
    });
    expect(screen.getByText('Question not recognized as a supported call reporting query.')).toBeInTheDocument();
  });

  it('shows generic error state on non-400 failure', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('Server error'));
    renderWithProviders(<ReportingPage />);
    fireEvent.click(screen.getByLabelText(/example: show failed calls today/i));
    await waitFor(() => {
      expect(screen.getByText('Query failed')).toBeInTheDocument();
    });
    expect(screen.getByText('Server error')).toBeInTheDocument();
  });

  it('shows loading state while query is running', async () => {
    let resolveQuery!: (v: unknown) => void;
    vi.mocked(apiRequest).mockReturnValueOnce(new Promise(r => { resolveQuery = r; }) as never);
    renderWithProviders(<ReportingPage />);
    fireEvent.change(screen.getByLabelText('Reporting question'), { target: { value: 'show calls' } });
    fireEvent.click(screen.getByRole('button', { name: /run query/i }));
    await waitFor(() => expect(screen.getByText('Running…')).toBeInTheDocument());
    resolveQuery({ data: { ...successResult, results: [], result_count: 0 } });
  });

  it('shows dash for null source in results table', async () => {
    const resultWithNullSource = {
      ...successResult,
      results: [{ call_id: 'call-null-src', event_type: 'outbound_call_failed', event_time: '2026-06-05T10:00:00Z', source: null }],
      result_count: 1,
    };
    vi.mocked(apiRequest).mockResolvedValue({ data: resultWithNullSource });
    renderWithProviders(<ReportingPage />);
    fireEvent.click(screen.getByLabelText(/example: show failed calls today/i));
    await waitFor(() => expect(screen.getByText('outbound_call_failed')).toBeInTheDocument());
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('Run button is disabled when question is empty', () => {
    renderWithProviders(<ReportingPage />);
    expect(screen.getByRole('button', { name: /run query/i })).toBeDisabled();
  });
});
