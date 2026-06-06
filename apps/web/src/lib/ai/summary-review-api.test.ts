import { describe, expect, it } from 'vitest';
import { outputStatusLabel, reasonLabel, sourceModeLabel, statusLabel, type SummaryReview } from './summary-review-api';

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
    summary_text: 'Summary',
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

describe('summary-review-api labels', () => {
  it('returns the expected labels for every review status', () => {
    expect(statusLabel(makeReview({ status: 'missing_analysis' }))).toBe('No analysis request');
    expect(statusLabel(makeReview({ status: 'queued' }))).toBe('Analysis queued');
    expect(statusLabel(makeReview({ status: 'processing' }))).toBe('Analysis running');
    expect(statusLabel(makeReview({ status: 'completed', summary_text: 'Ready' }))).toBe('Summary available');
    expect(statusLabel(makeReview({ status: 'completed', summary_text: null }))).toBe('Summary unavailable');
    expect(statusLabel(makeReview({ status: 'failed' }))).toBe('Analysis failed');
    expect(statusLabel(makeReview({ status: 'cancelled' }))).toBe('Analysis cancelled');
    expect(statusLabel(makeReview({ status: 'unavailable' }))).toBe('Unavailable');
  });

  it('returns the expected labels for every review reason', () => {
    expect(reasonLabel('no_linked_recording')).toMatch(/No linked recording/i);
    expect(reasonLabel('no_analysis_request')).toMatch(/No transcript or summary request/i);
    expect(reasonLabel('summary_missing')).toMatch(/without producing a summary/i);
    expect(reasonLabel('summary_retention_elapsed')).toMatch(/summary is no longer available/i);
    expect(reasonLabel('transcript_retention_elapsed')).toMatch(/transcript is no longer available/i);
    expect(reasonLabel('analysis_failed')).toMatch(/analysis run failed/i);
    expect(reasonLabel('analysis_cancelled')).toMatch(/analysis run was cancelled/i);
    expect(reasonLabel(null)).toBeNull();
  });

  it('returns source and output lifecycle labels', () => {
    expect(sourceModeLabel(makeReview())).toBe('Deterministic fallback');
    expect(sourceModeLabel(makeReview({ source_mode: 'provider_backed', provider_hint: 'openai' }))).toBe('Provider-backed (openai)');
    expect(outputStatusLabel('processing')).toBe('Running');
    expect(outputStatusLabel(null)).toBe('Not requested');
  });
});
