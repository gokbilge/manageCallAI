import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CallsPage } from './calls-page';
import { renderWithProviders } from '@/test/render';
import { apiRequest } from '@/lib/api/client';

vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: () => ({
    session: {
      token: 'token',
      claims: {
        tenant_id: 'tenant-1',
        role: 'tenant_admin',
      },
    },
  }),
}));

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return {
    ...actual,
    apiRequest: vi.fn(),
  };
});

describe('CallsPage', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  it('renders empty state when no events are returned', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [] });

    renderWithProviders(<CallsPage />);

    expect(screen.getByText('Loading call events...')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/No calls matched the current filters/i)).toBeInTheDocument();
    });
  });

  it('renders call summary rows and selected call detail', async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({
        data: [
          {
            id: 'evt-1',
            tenant_id: 'tenant-1',
            call_id: 'call-1',
            event_type: 'outbound_call_dispatched',
            event_time: '2026-05-27T00:00:00.000Z',
            source: 'freeswitch-agent',
            payload: { direction: 'outbound', to_number: '+14155550100', from_number: '1001' },
            ingested_at: '2026-05-27T00:00:01.000Z',
          },
          {
            id: 'evt-2',
            tenant_id: 'tenant-1',
            call_id: 'call-1',
            event_type: 'outbound_call_failed',
            event_time: '2026-05-27T00:00:03.000Z',
            source: 'freeswitch-agent',
            payload: { failure_reason: 'busy' },
            ingested_at: '2026-05-27T00:00:04.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        data: {
          resource_type: 'call',
          resource_id: 'call-1',
          call_id: 'call-1',
          linked_recording_id: 'rec-1',
          analysis_request_id: 'analysis-1',
          status: 'completed',
          transcript_status: null,
          summary_status: 'completed',
          source_mode: 'deterministic',
          provider_hint: 'auto',
          reason: null,
          summary_text: 'The outbound call failed because the destination was busy.',
          transcript_text: null,
          transcript_access: 'restricted',
          can_view_transcript: false,
          language: 'en',
          requested_outputs: ['summary'],
          completed_at: '2026-05-27T00:00:05.000Z',
          provider_metadata: {},
        },
      });

    renderWithProviders(<CallsPage />);

    await waitFor(() => {
      expect(screen.getByText('+14155550100')).toBeInTheDocument();
    });
    expect(screen.getAllByText(/failed: busy/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Call call-1/i)).toBeInTheDocument();
    expect(screen.getAllByText(/outbound_call_failed/i).length).toBeGreaterThan(0);
    expect(await screen.findByText(/destination was busy/i)).toBeInTheDocument();
  });

  const failedCallEvents = [
    {
      id: 'evt-a', tenant_id: 'tenant-1', call_id: 'call-failed',
      event_type: 'outbound_call_failed', event_time: '2026-05-27T00:00:01.000Z',
      source: 'go-agent', payload: { failure_reason: 'NO_ROUTE_FOR_PREFIX', direction: 'outbound', to_number: '+19999999999' },
      ingested_at: '2026-05-27T00:00:02.000Z',
    },
  ];

  const summaryReviewMissing = {
    resource_type: 'call', resource_id: 'call-failed', call_id: 'call-failed',
    linked_recording_id: null, analysis_request_id: null,
    status: 'unavailable', transcript_status: null, summary_status: null, source_mode: 'deterministic', provider_hint: 'auto', reason: 'no_linked_recording',
    summary_text: null, transcript_text: null, transcript_access: 'unavailable',
    can_view_transcript: false, language: null, requested_outputs: [],
    completed_at: null, provider_metadata: {},
  };

  it('shows Explain button for failed calls', async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({ data: failedCallEvents })
      .mockResolvedValue({ data: summaryReviewMissing });
    renderWithProviders(<CallsPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /explain call failure/i })).toBeInTheDocument();
    });
  });

  it('does not show Explain button for non-failed calls', async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({
        data: [{
          id: 'evt-1', tenant_id: 'tenant-1', call_id: 'call-ok',
          event_type: 'CHANNEL_HANGUP_COMPLETE', event_time: '2026-05-27T00:00:01.000Z',
          source: 'freeswitch', payload: { 'Hangup-Cause': 'NORMAL_CLEARING', direction: 'inbound', from_number: '+12223334444' },
          ingested_at: '2026-05-27T00:00:02.000Z',
        }],
      })
      .mockResolvedValue({ data: summaryReviewMissing });
    renderWithProviders(<CallsPage />);
    await waitFor(() => expect(screen.getByText('+12223334444')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /explain call failure/i })).not.toBeInTheDocument();
  });

  it('shows loading state while explain mutation is pending', async () => {
    let resolve!: (v: unknown) => void;
    const pending = new Promise(r => { resolve = r; });
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({ data: failedCallEvents })
      .mockResolvedValueOnce({ data: summaryReviewMissing })
      .mockReturnValueOnce(pending as never);
    renderWithProviders(<CallsPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /explain call failure/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /explain call failure/i }));
    await waitFor(() => expect(screen.getByText('Analyzing…')).toBeInTheDocument());
    resolve({ data: { status: 'explained', likely_cause: 'done', next_action: 'ok', observed_facts: [], event_timeline: [], is_advisory: true, call_id: 'call-failed', explained_at: new Date().toISOString() } });
  });

  it('shows explanation result after successful explain', async () => {
    const explanation = {
      call_id: 'call-failed', status: 'explained',
      observed_facts: [{ code: 'FAILURE_REASON', observed: 'Failure reason: NO_ROUTE_FOR_PREFIX.' }],
      likely_cause: 'No outbound route matched the dialed number prefix.',
      next_action: 'Check outbound routes.',
      event_timeline: [],
      is_advisory: true as const,
      explained_at: '2026-05-27T00:00:05.000Z',
    };
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({ data: failedCallEvents })
      .mockResolvedValueOnce({ data: summaryReviewMissing })
      .mockResolvedValue({ data: explanation });
    renderWithProviders(<CallsPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /explain call failure/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /explain call failure/i }));
    await waitFor(() => expect(screen.getByText('No outbound route matched the dialed number prefix.')).toBeInTheDocument());
    expect(screen.getByText('Check outbound routes.')).toBeInTheDocument();
    expect(screen.getByText('FAILURE_REASON')).toBeInTheDocument();
  });

  it('shows unavailable message when call is not actually failed', async () => {
    const unavailable = {
      call_id: 'call-failed', status: 'unavailable', unavailable_reason: 'not_failed',
      observed_facts: [], likely_cause: '', next_action: '',
      event_timeline: [], is_advisory: true as const,
      explained_at: '2026-05-27T00:00:05.000Z',
    };
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({ data: failedCallEvents })
      .mockResolvedValueOnce({ data: summaryReviewMissing })
      .mockResolvedValue({ data: unavailable });
    renderWithProviders(<CallsPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /explain call failure/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /explain call failure/i }));
    await waitFor(() => expect(screen.getByText(/does not appear to have failed/i)).toBeInTheDocument());
  });

  it('shows error state when explanation API fails', async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({ data: failedCallEvents })
      .mockResolvedValueOnce({ data: summaryReviewMissing })
      .mockRejectedValue(new Error('Explain API error'));
    renderWithProviders(<CallsPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /explain call failure/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /explain call failure/i }));
    await waitFor(() => expect(screen.getByText('Explain API error')).toBeInTheDocument());
  });

  it('shows capability-missing message when role lacks explain_failure capability', async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({ data: failedCallEvents })
      .mockResolvedValue({ data: summaryReviewMissing });
    renderWithProviders(<CallsPage />);
    // tenant_admin has the capability, so Explain button is present and capability message is absent
    await waitFor(() => expect(screen.getByRole('button', { name: /explain call failure/i })).toBeInTheDocument());
    expect(screen.queryByText(/explain_failure capability/i)).not.toBeInTheDocument();
  });

  it('filters call summaries by outcome', async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: [
        {
          id: 'evt-1',
          tenant_id: 'tenant-1',
          call_id: 'call-active',
          event_type: 'channel_create',
          event_time: '2026-05-27T00:00:00.000Z',
          source: 'freeswitch-agent',
          payload: { direction: 'inbound', from_number: '+14155550101' },
          ingested_at: '2026-05-27T00:00:01.000Z',
        },
        {
          id: 'evt-2',
          tenant_id: 'tenant-1',
          call_id: 'call-failed',
          event_type: 'outbound_call_failed',
          event_time: '2026-05-27T00:01:00.000Z',
          source: 'freeswitch-agent',
          payload: { direction: 'outbound', to_number: '+14155550102', failure_reason: 'rejected' },
          ingested_at: '2026-05-27T00:01:01.000Z',
        },
      ],
    });

    renderWithProviders(<CallsPage />);

    await waitFor(() => {
      expect(screen.getByText('+14155550101')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Outcome filter'), { target: { value: 'failed' } });

    await waitFor(() => {
      expect(screen.queryByText('+14155550101')).not.toBeInTheDocument();
    });
    expect(screen.getAllByText('+14155550102').length).toBeGreaterThan(0);
  });
});
