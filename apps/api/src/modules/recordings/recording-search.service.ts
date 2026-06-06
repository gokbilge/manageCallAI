import type { RecordingSearchRepository, RawLexicalRow, RawSearchRow } from './recording-search.repository.js';
import type {
  RecordingSearchInput,
  RecordingSearchMatchType,
  RecordingSearchResponse,
  RecordingSearchResult,
} from './recording-search.types.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function snippetContext(text: string, searchQuery: string, maxLen = 200): string {
  const lower = text.toLowerCase();
  const qLower = searchQuery.toLowerCase().split(/\s+/)[0] ?? '';
  const idx = qLower ? lower.indexOf(qLower) : -1;
  if (idx === -1) return text.slice(0, maxLen) + (text.length > maxLen ? '…' : '');
  const start = Math.max(0, idx - 60);
  const end = Math.min(text.length, idx + 140);
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
}

function fromFtsRow(row: RawSearchRow): RecordingSearchResult {
  const transcriptRank = Number(row.transcript_rank ?? 0);
  const summaryRank = Number(row.summary_rank ?? 0);

  let matchType: RecordingSearchMatchType;
  let matchContext: string;
  let matchScore: number;

  if (transcriptRank > 0 && summaryRank > 0) {
    matchType = 'both';
    matchContext = row.transcript_headline ?? row.summary_headline ?? '';
    matchScore = Math.max(transcriptRank, summaryRank);
  } else if (transcriptRank > 0) {
    matchType = 'transcript';
    matchContext = row.transcript_headline ?? '';
    matchScore = transcriptRank;
  } else {
    matchType = 'summary';
    matchContext = row.summary_headline ?? '';
    matchScore = summaryRank;
  }

  const reason = matchType === 'both'
    ? `Query matched in both transcript and summary.`
    : `Query matched in ${matchType}. Relevance score: ${matchScore.toFixed(4)}.`;

  return {
    recording_id: row.recording_id,
    call_id: row.call_id,
    recorded_at: row.recorded_at instanceof Date ? row.recorded_at.toISOString() : String(row.recorded_at),
    duration_secs: row.duration_secs,
    match_type: matchType,
    match_score: matchScore,
    match_context: matchContext,
    match_reason: reason,
    is_advisory: true,
  };
}

function fromLexicalRow(row: RawLexicalRow, searchQuery: string): RecordingSearchResult {
  const inTranscript = !!row.transcript_text?.toLowerCase().includes(searchQuery.toLowerCase());
  const inSummary = !!row.summary_text?.toLowerCase().includes(searchQuery.toLowerCase());

  const matchType: RecordingSearchMatchType =
    inTranscript && inSummary ? 'both' : inTranscript ? 'transcript' : 'summary';

  const sourceText = inTranscript ? row.transcript_text! : row.summary_text!;
  const matchContext = snippetContext(sourceText, searchQuery);

  return {
    recording_id: row.recording_id,
    call_id: row.call_id,
    recorded_at: row.recorded_at instanceof Date ? row.recorded_at.toISOString() : String(row.recorded_at),
    duration_secs: row.duration_secs,
    match_type: matchType,
    match_score: 0,
    match_context: matchContext,
    match_reason: `Lexical fallback: query "${searchQuery}" found in ${matchType}.`,
    is_advisory: true,
  };
}

export class RecordingSearchService {
  constructor(private readonly repo: RecordingSearchRepository) {}

  async search(tenantId: string, input: RecordingSearchInput): Promise<RecordingSearchResponse> {
    const limit = Math.min(input.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const filter = input.filter ?? {};

    const ftsRows = await this.repo.searchFts(tenantId, input.query, filter, limit);

    if (ftsRows.length > 0) {
      const results = ftsRows.map((r) => fromFtsRow(r));
      return { query: input.query, mode: 'fts', total: results.length, results };
    }

    const lexRows = await this.repo.searchLexical(tenantId, input.query, filter, limit);
    const results = lexRows.map((r) => fromLexicalRow(r, input.query));
    return { query: input.query, mode: 'lexical_fallback', total: results.length, results };
  }
}
