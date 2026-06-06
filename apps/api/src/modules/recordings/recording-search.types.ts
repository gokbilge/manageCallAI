export type RecordingSearchMatchType = 'transcript' | 'summary' | 'both';
export type RecordingSearchMode = 'fts' | 'lexical_fallback';

export interface RecordingSearchResult {
  recording_id: string;
  call_id: string;
  recorded_at: string;
  duration_secs: number | null;
  match_type: RecordingSearchMatchType;
  match_score: number;
  match_context: string;
  match_reason: string;
  is_advisory: true;
}

export interface RecordingSearchResponse {
  query: string;
  mode: RecordingSearchMode;
  total: number;
  results: RecordingSearchResult[];
}

export interface RecordingSearchFilter {
  from_date?: string;
  to_date?: string;
  call_id?: string;
}

export interface RecordingSearchInput {
  query: string;
  filter?: RecordingSearchFilter;
  limit?: number;
}
