import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SummaryReviewPanel } from './summary-review-panel';
import type { SummaryReview } from '@/lib/ai/summary-review-api';

function makeReview(overrides: Partial<SummaryReview> = {}): SummaryReview {
  return {
    resource_type: 'recording',
    resource_id: 'rec-1',
    call_id: 'call-1',
    linked_recording_id: 'rec-1',
    analysis_request_id: 'analysis-1',
    status: 'completed',
    transcript_status: null,
    summary_status: 'completed',
    source_mode: 'deterministic',
    provider_hint: 'auto',
    reason: null,
    summary_text: 'Summary available for the operator.',
    transcript_text: null,
    transcript_access: 'restricted',
    can_view_transcript: false,
    language: 'en',
    requested_outputs: ['summary'],
    completed_at: '2026-06-05T10:00:00.000Z',
    provider_metadata: {},
    ...overrides,
  };
}

describe('SummaryReviewPanel', () => {
  it('renders loading, error, and empty states', () => {
    const { rerender } = render(
      <SummaryReviewPanel
        review={null}
        isLoading
        error={null}
        emptyMessage="No review available yet."
      />,
    );

    expect(screen.getByText('Loading AI review...')).toBeInTheDocument();

    rerender(
      <SummaryReviewPanel
        review={null}
        isLoading={false}
        error="Summary service unavailable"
        emptyMessage="No review available yet."
      />,
    );

    expect(screen.getByText('Summary service unavailable')).toBeInTheDocument();

    rerender(
      <SummaryReviewPanel
        review={null}
        isLoading={false}
        error={null}
        emptyMessage="No review available yet."
      />,
    );

    expect(screen.getByText('No review available yet.')).toBeInTheDocument();
  });

  it('renders restricted transcript messaging and explicit reason details', () => {
    render(
      <SummaryReviewPanel
        review={makeReview({
          reason: 'summary_retention_elapsed',
          transcript_access: 'restricted',
          summary_text: null,
        })}
        isLoading={false}
        error={null}
        emptyMessage="No review available yet."
      />,
    );

    expect(screen.getByText('Summary unavailable')).toBeInTheDocument();
    expect(screen.getByText(/summary is no longer available under the current retention window/i)).toBeInTheDocument();
    expect(screen.getByText(/Transcript access requires compliance scope/i)).toBeInTheDocument();
    expect(screen.getByText(/No summary is currently available/i)).toBeInTheDocument();
    expect(screen.getByText('Deterministic fallback')).toBeInTheDocument();
  });

  it('renders transcript text when transcript access is granted', () => {
    render(
      <SummaryReviewPanel
        review={makeReview({
          transcript_access: 'granted',
          transcript_text: 'Operator-visible transcript.',
        })}
        isLoading={false}
        error={null}
        emptyMessage="No review available yet."
      />,
    );

    expect(screen.getByText('granted')).toBeInTheDocument();
    expect(screen.getByText('Operator-visible transcript.')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('renders unavailable transcript messaging when no transcript can be shown', () => {
    render(
      <SummaryReviewPanel
        review={makeReview({
          status: 'unavailable',
          transcript_access: 'unavailable',
          summary_text: null,
          transcript_text: null,
        })}
        isLoading={false}
        error={null}
        emptyMessage="No review available yet."
      />,
    );

    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByText(/Transcript text is not available for review/i)).toBeInTheDocument();
  });

  it('renders provider-backed source details', () => {
    render(
      <SummaryReviewPanel
        review={makeReview({
          source_mode: 'provider_backed',
          provider_hint: 'openai',
          summary_status: 'completed',
          transcript_status: 'processing',
        })}
        isLoading={false}
        error={null}
        emptyMessage="No review available yet."
      />,
    );

    expect(screen.getByText('Provider-backed (openai)')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
  });
});
