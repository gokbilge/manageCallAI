import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';

export type ExplanationStatus = 'explained' | 'unavailable';
export type UnavailableReason = 'no_events' | 'not_failed';

export type FailureFact = {
  code: string;
  observed: string;
};

export type ExplainEventSummary = {
  event_type: string;
  event_time: string;
  source: string | null;
};

export type CallFailureExplanation = {
  call_id: string;
  status: ExplanationStatus;
  unavailable_reason?: UnavailableReason;
  observed_facts: FailureFact[];
  likely_cause: string;
  next_action: string;
  event_timeline: ExplainEventSummary[];
  is_advisory: true;
  explained_at: string;
};

export function useCallFailureExplanation() {
  const { session } = useAuth();
  return useMutation({
    mutationFn: (callId: string) =>
      apiRequest<{ data: CallFailureExplanation }>('/calls/explain-failure', {
        method: 'POST',
        accessToken: session!.token,
        body: JSON.stringify({ call_id: callId }),
      }),
  });
}
