import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupervisorArtifactSearchService } from './supervisor-artifact-search.service.js';
import type { SupervisorArtifactSearchRepository } from './supervisor-artifact-search.repository.js';

function makeRepo(): SupervisorArtifactSearchRepository {
  return {
    searchRecordings: vi.fn().mockResolvedValue([]),
    searchNotes: vi.fn().mockResolvedValue([]),
    searchDispositions: vi.fn().mockResolvedValue([]),
  } as unknown as SupervisorArtifactSearchRepository;
}

describe('SupervisorArtifactSearchService', () => {
  let repo: SupervisorArtifactSearchRepository;
  let service: SupervisorArtifactSearchService;

  beforeEach(() => {
    repo = makeRepo();
    service = new SupervisorArtifactSearchService(repo);
  });

  it('returns empty results when nothing matches', async () => {
    const result = await service.search('t1', { query: 'billing' });
    expect(result.results).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.query).toBe('billing');
  });

  it('searches all artifact types by default', async () => {
    await service.search('t1', { query: 'billing' });
    expect(vi.mocked(repo.searchRecordings)).toHaveBeenCalledOnce();
    expect(vi.mocked(repo.searchNotes)).toHaveBeenCalledOnce();
    expect(vi.mocked(repo.searchDispositions)).toHaveBeenCalledOnce();
  });

  it('restricts to requested artifact types', async () => {
    await service.search('t1', { query: 'billing', filter: { artifact_types: ['note'] } });
    expect(vi.mocked(repo.searchNotes)).toHaveBeenCalledOnce();
    expect(vi.mocked(repo.searchRecordings)).not.toHaveBeenCalled();
    expect(vi.mocked(repo.searchDispositions)).not.toHaveBeenCalled();
  });

  it('merges results from multiple artifact types', async () => {
    vi.mocked(repo.searchNotes).mockResolvedValue([
      { call_id: 'c1', artifact_id: 'n1', recorded_at: new Date('2026-01-01'), content: 'billing note' },
    ]);
    vi.mocked(repo.searchDispositions).mockResolvedValue([
      { call_id: 'c2', artifact_id: 'd1', recorded_at: new Date('2026-01-02'), code: 'BILLING', label: 'Billing', note: null },
    ]);
    const result = await service.search('t1', { query: 'billing' });
    expect(result.results).toHaveLength(2);
    const types = result.results.map((r) => r.artifact_type);
    expect(types).toContain('note');
    expect(types).toContain('disposition');
  });

  it('marks all results is_advisory=true', async () => {
    vi.mocked(repo.searchNotes).mockResolvedValue([
      { call_id: 'c1', artifact_id: 'n1', recorded_at: new Date(), content: 'billing' },
    ]);
    const result = await service.search('t1', { query: 'billing' });
    expect(result.results.every((r) => r.is_advisory === true)).toBe(true);
  });

  it('respects limit', async () => {
    vi.mocked(repo.searchRecordings).mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({
        call_id: `c${i}`, artifact_id: `r${i}`,
        recorded_at: new Date(), transcript_text: 'billing text', summary_text: null,
      })),
    );
    const result = await service.search('t1', { query: 'billing', limit: 3 });
    expect(result.results.length).toBeLessThanOrEqual(3);
  });
});
