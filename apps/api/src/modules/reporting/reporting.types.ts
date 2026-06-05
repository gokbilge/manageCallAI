export type CallDirection = 'inbound' | 'outbound';
export type CallStatus = 'failed' | 'completed' | 'active';
export type TimeRange = 'last_hour' | 'today' | 'yesterday' | 'last_7_days';
export type AggregationMode = 'count' | 'list';

export interface ParsedQuery {
  direction?: CallDirection;
  status?: CallStatus;
  time_range?: TimeRange;
  aggregation: AggregationMode;
  raw: string;
}

export interface ReportFilter {
  dimension: string;
  value: string;
}

export interface ReportCallRow {
  call_id: string;
  event_type: string;
  event_time: string;
  source: string | null;
}

export interface NlQueryResult {
  question: string;
  applied_filters: ReportFilter[];
  explanation: string;
  result_count: number;
  results: ReportCallRow[];
  is_advisory: true;
  queried_at: string;
}
