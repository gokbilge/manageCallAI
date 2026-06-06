import { describe, expect, it, vi } from 'vitest';
import type { RecordingSearchRepository, RawLexicalRow, RawSearchRow } from './recording-search.repository.js';
import { RecordingSearchService } from './recording-search.service.js';

const TENANT = 'tenant-1';
const now = new Date('2026-06-06T10:00:00Z');

function makeFtsRow(overrides: Partial<RawSearchRow> = {}): RawSearchRow {
  return {
    recording_id: 'rec-1',
    call_id: 'call-1',
    recorded_at: now,
    duration_secs: 180,
    transcript_text: 'The customer asked about billing and refund policy.',
    summary_text: 'Billing inquiry resolved.',
    transcript_rank: 0.0759,
    summary_rank: 0,
    transcript_headline: 'The customer asked about <<billing>> and refund policy.',
    summary_headline: null,
    ...overrides,
  };
}

function makeLexicalRow(overrides: Partial<RawLexicalRow> = {}): RawLexicalRow {
  return {
    recording_id: 'rec-2',
    call_id: 'call-2',
    recorded_at: now,
    duration_secs: 90,
    transcript_text: 'Caller asked about refund options.',
    summary_text: null,
    ...overrides,
  };
}

function makeRepo(overrides: Partial<RecordingSearchRepository> = {}): RecordingSearchRepository {
  return {
    searchFts: vi.fn().mockResolvedValue([makeFtsRow()]),
    searchLexical: vi.fn().mockResolvedValue([makeLexicalRow()]),
    ...overrides,
  } as unknown as RecordingSearchRepository;
}

describe('RecordingSearchService', () => {
  it('returns FTS results when full-text search finds matches', async () => {
    const repo = makeRepo();
    const service = new RecordingSearchService(repo);

    const result = await service.search(TENANT, { query: 'billing' });

    expect(result.mode).toBe('fts');
    expect(result.results.length).toBe(1);
    expect(result.results[0]!.match_type).toBe('transcript');
    expect(result.results[0]!.match_score).toBeGreaterThan(0);
    expect(result.results[0]!.match_context).toContain('billing');
    expect(result.results[0]!.is_advisory).toBe(true);
    expect(repo.searchLexical).not.toHaveBeenCalled();
  });

  it('falls back to lexical search when FTS returns no results', async () => {
    const repo = makeRepo({ searchFts: vi.fn().mockResolvedValue([]) });
    const service = new RecordingSearchService(repo);

    const result = await service.search(TENANT, { query: 'refund' });

    expect(result.mode).toBe('lexical_fallback');
    expect(result.results.length).toBe(1);
    expect(result.results[0]!.match_type).toBe('transcript');
    expect(result.results[0]!.match_score).toBe(0);
    expect(repo.searchLexical).toHaveBeenCalledWith(TENANT, 'refund', {}, 20);
  });

  it('classifies match_type as "both" when transcript and summary both match in FTS', async () => {
    const repo = makeRepo({
      searchFts: vi.fn().mockResolvedValue([
        makeFtsRow({ transcript_rank: 0.05, summary_rank: 0.03 }),
      ]),
    });
    const service = new RecordingSearchService(repo);

    const result = await service.search(TENANT, { query: 'billing' });

    expect(result.results[0]!.match_type).toBe('both');
    expect(result.results[0]!.match_score).toBeGreaterThan(0);
  });

  it('classifies match_type as "summary" when only summary matches in FTS', async () => {
    const repo = makeRepo({
      searchFts: vi.fn().mockResolvedValue([
        makeFtsRow({ transcript_rank: 0, summary_rank: 0.08, transcript_headline: null }),
      ]),
    });
    const service = new RecordingSearchService(repo);

    const result = await service.search(TENANT, { query: 'billing' });

    expect(result.results[0]!.match_type).toBe('summary');
  });

  it('classifies match_type as "both" in lexical when both fields contain query', async () => {
    const repo = makeRepo({
      searchFts: vi.fn().mockResolvedValue([]),
      searchLexical: vi.fn().mockResolvedValue([
        makeLexicalRow({
          transcript_text: 'Caller mentioned billing.',
          summary_text: 'Billing inquiry.',
        }),
      ]),
    });
    const service = new RecordingSearchService(repo);

    const result = await service.search(TENANT, { query: 'billing' });

    expect(result.results[0]!.match_type).toBe('both');
  });

  it('returns empty results when neither FTS nor lexical finds matches', async () => {
    const repo = makeRepo({
      searchFts: vi.fn().mockResolvedValue([]),
      searchLexical: vi.fn().mockResolvedValue([]),
    });
    const service = new RecordingSearchService(repo);

    const result = await service.search(TENANT, { query: 'xyznonexistent' });

    expect(result.results).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('passes filter and limit to the repository', async () => {
    const repo = makeRepo();
    const service = new RecordingSearchService(repo);

    await service.search(TENANT, {
      query: 'billing',
      filter: { from_date: '2026-06-01T00:00:00Z', to_date: '2026-06-06T23:59:59Z' },
      limit: 5,
    });

    expect(repo.searchFts).toHaveBeenCalledWith(
      TENANT,
      'billing',
      { from_date: '2026-06-01T00:00:00Z', to_date: '2026-06-06T23:59:59Z' },
      5,
    );
  });

  it('caps limit at 100', async () => {
    const repo = makeRepo();
    const service = new RecordingSearchService(repo);

    await service.search(TENANT, { query: 'test', limit: 999 });

    expect(repo.searchFts).toHaveBeenCalledWith(TENANT, 'test', {}, 100);
  });

  it('includes recorded_at as ISO string in results', async () => {
    const repo = makeRepo();
    const service = new RecordingSearchService(repo);

    const result = await service.search(TENANT, { query: 'billing' });

    expect(result.results[0]!.recorded_at).toBe(now.toISOString());
  });
});
