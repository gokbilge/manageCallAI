import type { SupervisorArtifactSearchRepository, RawRecordingArtifactRow, RawNoteRow, RawDispositionRow } from './supervisor-artifact-search.repository.js';
import type {
  ArtifactSearchInput,
  ArtifactSearchResponse,
  ArtifactSearchResult,
  ArtifactType,
} from './supervisor-artifact-search.types.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function snippetContext(text: string, query: string, maxLen = 200): string {
  const lower = text.toLowerCase();
  const qLower = query.toLowerCase().split(/\s+/)[0] ?? '';
  const idx = qLower ? lower.indexOf(qLower) : -1;
  if (idx === -1) return text.slice(0, maxLen) + (text.length > maxLen ? '…' : '');
  const start = Math.max(0, idx - 60);
  const end = Math.min(text.length, idx + 140);
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}

function fromRecordingRow(row: RawRecordingArtifactRow, query: string): ArtifactSearchResult {
  const inTranscript = !!row.transcript_text?.toLowerCase().includes(query.toLowerCase());
  const sourceText = inTranscript ? (row.transcript_text ?? '') : (row.summary_text ?? '');
  return {
    artifact_type: 'recording',
    call_id: row.call_id,
    artifact_id: row.artifact_id,
    recorded_at: row.recorded_at instanceof Date ? row.recorded_at.toISOString() : (row.recorded_at ? String(row.recorded_at) : null),
    match_context: snippetContext(sourceText, query),
    match_score: 0,
    is_advisory: true,
  };
}

function fromNoteRow(row: RawNoteRow, query: string): ArtifactSearchResult {
  return {
    artifact_type: 'note',
    call_id: row.call_id,
    artifact_id: row.artifact_id,
    recorded_at: row.recorded_at instanceof Date ? row.recorded_at.toISOString() : (row.recorded_at ? String(row.recorded_at) : null),
    match_context: snippetContext(row.content, query),
    match_score: 0,
    is_advisory: true,
  };
}

function fromDispositionRow(row: RawDispositionRow): ArtifactSearchResult {
  const matchContext = row.note
    ? `${row.code} – ${row.label}: ${row.note}`
    : `${row.code} – ${row.label}`;
  return {
    artifact_type: 'disposition',
    call_id: row.call_id,
    artifact_id: row.artifact_id,
    recorded_at: row.recorded_at instanceof Date ? row.recorded_at.toISOString() : (row.recorded_at ? String(row.recorded_at) : null),
    match_context: matchContext,
    match_score: 0,
    is_advisory: true,
  };
}

export class SupervisorArtifactSearchService {
  constructor(private readonly repo: SupervisorArtifactSearchRepository) {}

  async search(tenantId: string, input: ArtifactSearchInput): Promise<ArtifactSearchResponse> {
    const limit = Math.min(input.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const filter = input.filter ?? {};
    const types: ArtifactType[] = filter.artifact_types?.length
      ? filter.artifact_types
      : ['recording', 'note', 'disposition'];

    const perTypeLimit = Math.ceil(limit / types.length);
    const results: ArtifactSearchResult[] = [];

    const jobs: Promise<void>[] = [];

    if (types.includes('recording')) {
      jobs.push(
        this.repo.searchRecordings(tenantId, input.query, filter, perTypeLimit).then((rows) => {
          for (const r of rows) results.push(fromRecordingRow(r, input.query));
        }),
      );
    }
    if (types.includes('note')) {
      jobs.push(
        this.repo.searchNotes(tenantId, input.query, filter, perTypeLimit).then((rows) => {
          for (const r of rows) results.push(fromNoteRow(r, input.query));
        }),
      );
    }
    if (types.includes('disposition')) {
      jobs.push(
        this.repo.searchDispositions(tenantId, input.query, filter, perTypeLimit).then((rows) => {
          for (const r of rows) results.push(fromDispositionRow(r));
        }),
      );
    }

    await Promise.all(jobs);

    results.sort((a, b) => {
      if (a.recorded_at && b.recorded_at) return b.recorded_at.localeCompare(a.recorded_at);
      return 0;
    });

    const trimmed = results.slice(0, limit);
    return { query: input.query, total: trimmed.length, results: trimmed };
  }
}
