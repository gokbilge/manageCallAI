export type ArtifactType = 'recording' | 'note' | 'disposition';

export interface ArtifactSearchResult {
  artifact_type: ArtifactType;
  call_id: string;
  artifact_id: string;
  recorded_at: string | null;
  match_context: string;
  match_score: number;
  is_advisory: true;
}

export interface ArtifactSearchResponse {
  query: string;
  total: number;
  results: ArtifactSearchResult[];
}

export interface ArtifactSearchFilter {
  from_date?: string;
  to_date?: string;
  call_id?: string;
  artifact_types?: ArtifactType[];
}

export interface ArtifactSearchInput {
  query: string;
  filter?: ArtifactSearchFilter;
  limit?: number;
}
