export interface CallEvent {
  id: string;
  tenant_id: string;
  call_id: string;
  event_type: string;
  event_time: Date;
  source: string | null;
  payload: Record<string, unknown>;
  ingested_at: Date;
}

export interface IngestCallEventInput {
  tenant_id: string;
  call_id: string;
  event_type: string;
  event_time?: string;
  source?: string;
  payload?: Record<string, unknown>;
}
