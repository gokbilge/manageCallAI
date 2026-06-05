export type ExplanationStatus = 'explained' | 'unavailable';
export type UnavailableReason = 'no_events' | 'not_failed';

export interface FailureFact {
  code: string;
  observed: string;
}

export interface ExplainEventSummary {
  event_type: string;
  event_time: string;
  source: string | null;
}

export interface CallFailureExplanation {
  call_id: string;
  status: ExplanationStatus;
  unavailable_reason?: UnavailableReason;
  observed_facts: FailureFact[];
  likely_cause: string;
  next_action: string;
  event_timeline: ExplainEventSummary[];
  is_advisory: true;
  explained_at: string;
}

export interface CallEventRow {
  call_id: string;
  event_type: string;
  event_time: Date;
  source: string | null;
  payload: Record<string, unknown>;
}
