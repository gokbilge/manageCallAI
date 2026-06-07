import { describe, it, expect, vi } from 'vitest';
import type { Pool } from 'pg';
import { RecordingSearchRepository } from './recording-search.repository.js';

const TENANT = 'tenant-1';

const baseSearchRow = {
  recording_id: 'rec-1', call_id: 'call-1', recorded_at: new Date(),
  duration_secs: 120, transcript_text: 'hello world', summary_text: 'greeting',
  transcript_rank: 0.8, summary_rank: 0.5,
  transcript_headline: '<<hello>> world', summary_headline: 'greeting',
};

const baseLexicalRow = {
  recording_id: 'rec-1', call_id: 'call-1', recorded_at: new Date(),
  duration_secs: 120, transcript_text: 'hello world', summary_text: 'greeting',
};

function makePool(rows: unknown[] = []): Pool {
  return { query: vi.fn().mockResolvedValue({ rows }) } as unknown as Pool;
}

describe('RecordingSearchRepository', () => {
  it('searchFts returns matching recordings', async () => {
    const pool = makePool([baseSearchRow]);
    const result = await new RecordingSearchRepository(pool).searchFts(TENANT, 'hello', {}, 10);
    expect(result).toHaveLength(1);
    expect(result[0]!.recording_id).toBe('rec-1');
  });

  it('searchFts with all filters builds extended WHERE clause', async () => {
    const pool = makePool([baseSearchRow]);
    await new RecordingSearchRepository(pool).searchFts(TENANT, 'hello', { from_date: '2026-01-01', to_date: '2026-12-31', call_id: 'call-1' }, 5);
    const call = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(call[1]).toContain('2026-01-01');
    expect(call[1]).toContain('2026-12-31');
    expect(call[1]).toContain('call-1');
  });

  it('searchFts returns empty array when no matches', async () => {
    const pool = makePool([]);
    const result = await new RecordingSearchRepository(pool).searchFts(TENANT, 'nothing', {}, 10);
    expect(result).toHaveLength(0);
  });

  it('searchLexical returns matching recordings', async () => {
    const pool = makePool([baseLexicalRow]);
    const result = await new RecordingSearchRepository(pool).searchLexical(TENANT, 'hello', {}, 10);
    expect(result).toHaveLength(1);
    expect(result[0]!.call_id).toBe('call-1');
  });

  it('searchLexical with all filters builds extended WHERE clause', async () => {
    const pool = makePool([baseLexicalRow]);
    await new RecordingSearchRepository(pool).searchLexical(TENANT, 'hello', { from_date: '2026-01-01', to_date: '2026-12-31', call_id: 'call-1' }, 5);
    const call = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(call[1]).toContain('2026-01-01');
    expect(call[1]).toContain('call-1');
  });

  it('searchLexical escapes special LIKE characters in query', async () => {
    const pool = makePool([]);
    await new RecordingSearchRepository(pool).searchLexical(TENANT, 'he%llo_world', {}, 10);
    const call = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(call[1][1] as string).toContain('\\%');
    expect(call[1][1] as string).toContain('\\_');
  });

  it('searchLexical returns empty array when no matches', async () => {
    const pool = makePool([]);
    expect(await new RecordingSearchRepository(pool).searchLexical(TENANT, 'nothing', {}, 10)).toHaveLength(0);
  });
});
