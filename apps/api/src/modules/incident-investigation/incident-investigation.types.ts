import type {
  IncidentInvestigation,
  InvestigationCitation,
  InvestigationContext,
} from '@managecallai/contracts';

export type { IncidentInvestigation, InvestigationCitation, InvestigationContext };

export interface CallEventRow {
  call_id: string;
  event_type: string;
  event_time: Date;
  source: string | null;
  payload: Record<string, unknown>;
}

export interface RouteRow {
  id: string;
  name: string;
  status: string;
  match_value?: string;
  match_type?: string;
  target_type?: string;
  target_id?: string | null;
  match_prefix?: string;
  priority?: number;
}

export interface GatewayStatusRow {
  gateway_name: string;
  state: string;
  ping_time_ms: number | null;
  updated_at: Date;
}

export interface RecordingEvidenceRow {
  recording_id: string;
  call_id: string;
  recorded_at: Date;
  summary_text: string | null;
  transcript_text: string | null;
  source_mode: 'deterministic' | 'provider_backed' | null;
  provider_hint: string | null;
}
