import { useQuery } from '@tanstack/react-query';
import { ApiError, apiRequest } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';

export type SummaryReviewStatus =
  | 'missing_analysis'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'unavailable';

export type SummaryReview = {
  resource_type: 'call' | 'recording' | 'voicemail';
  resource_id: string;
  call_id: string;
  linked_recording_id: string | null;
  analysis_request_id: string | null;
  status: SummaryReviewStatus;
  transcript_status: SummaryReviewStatus | null;
  summary_status: SummaryReviewStatus | null;
  source_mode: 'deterministic' | 'provider_backed';
  provider_hint: 'auto' | 'openai' | 'elevenlabs' | 'whisper' | 'external' | 'custom';
  reason:
    | 'no_linked_recording'
    | 'no_analysis_request'
    | 'summary_missing'
    | 'summary_retention_elapsed'
    | 'transcript_retention_elapsed'
    | 'analysis_failed'
    | 'analysis_cancelled'
    | null;
  summary_text: string | null;
  transcript_text: string | null;
  transcript_access: 'granted' | 'restricted' | 'unavailable';
  can_view_transcript: boolean;
  language: string | null;
  requested_outputs: Array<'transcript' | 'summary'>;
  completed_at: string | null;
  provider_metadata: Record<string, unknown>;
};

function noRetryOnAuthOrPolicyError(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403 || error.status === 404)) return false;
  return failureCount < 1;
}

export function useRecordingSummaryReview(recordingId: string | null) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['summary-review', 'recording', recordingId, session?.claims.tenant_id],
    enabled: Boolean(session?.token && recordingId),
    retry: noRetryOnAuthOrPolicyError,
    queryFn: async () => {
      const result = await apiRequest<{ data: SummaryReview }>(`/recordings/${recordingId}/summary-review`, {
        accessToken: session?.token,
      });
      return result.data;
    },
  });
}

export function useCallSummaryReview(callId: string | null, enabled = true) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['summary-review', 'call', callId, session?.claims.tenant_id],
    enabled: Boolean(session?.token && callId && enabled),
    retry: noRetryOnAuthOrPolicyError,
    queryFn: async () => {
      const result = await apiRequest<{ data: SummaryReview }>(`/recordings/summary-review/by-call/${encodeURIComponent(callId!)}`, {
        accessToken: session?.token,
      });
      return result.data;
    },
  });
}

export function statusLabel(review: SummaryReview): string {
  switch (review.status) {
    case 'missing_analysis':
      return 'No analysis request';
    case 'queued':
      return 'Analysis queued';
    case 'processing':
      return 'Analysis running';
    case 'completed':
      return review.summary_text ? 'Summary available' : 'Summary unavailable';
    case 'failed':
      return 'Analysis failed';
    case 'cancelled':
      return 'Analysis cancelled';
    case 'unavailable':
      return 'Unavailable';
  }
}

export function reasonLabel(reason: SummaryReview['reason']): string | null {
  switch (reason) {
    case 'no_linked_recording':
      return 'No linked recording was found for this call.';
    case 'no_analysis_request':
      return 'No transcript or summary request has completed for this recording yet.';
    case 'summary_missing':
      return 'The analysis run completed without producing a summary.';
    case 'summary_retention_elapsed':
      return 'The summary is no longer available under the current retention window.';
    case 'transcript_retention_elapsed':
      return 'The transcript is no longer available under the current retention window.';
    case 'analysis_failed':
      return 'The analysis run failed and did not produce reviewable output.';
    case 'analysis_cancelled':
      return 'The analysis run was cancelled before it produced output.';
    default:
      return null;
  }
}

export function outputStatusLabel(status: SummaryReviewStatus | null): string {
  switch (status) {
    case 'queued':
      return 'Queued';
    case 'processing':
      return 'Running';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Not requested';
  }
}

export function sourceModeLabel(review: SummaryReview): string {
  if (review.source_mode === 'provider_backed') {
    return review.provider_hint === 'auto'
      ? 'Provider-backed'
      : `Provider-backed (${review.provider_hint})`;
  }
  return 'Deterministic fallback';
}
