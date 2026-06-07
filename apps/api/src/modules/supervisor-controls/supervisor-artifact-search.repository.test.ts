import { describe, it, expect, vi } from 'vitest';
import type { Pool } from 'pg';
import { SupervisorArtifactSearchRepository } from './supervisor-artifact-search.repository.js';

const TENANT = 'tenant-1';

const baseRecording = {
  call_id: 'call-1', artifact_id: 'rec-1', recorded_at: new Date(),
  transcript_text: 'hello world', summary_text: 'greeting',
};

const baseNote = {
  call_id: 'call-1', artifact_id: 'note-1', recorded_at: new Date(), content: 'hello world',
};

const baseDisposition = {
  call_id: 'call-1', artifact_id: 'disp-1', recorded_at: new Date(),
  code: 'RESOLVED', label: 'Issue Resolved', note: 'customer satisfied',
};

function makePool(rows: unknown[] = []): Pool {
  return { query: vi.fn().mockResolvedValue({ rows }) } as unknown as Pool;
}

describe('SupervisorArtifactSearchRepository', () => {
  it('searchRecordings returns matching recordings', async () => {
    const pool = makePool([baseRecording]);
    const result = await new SupervisorArtifactSearchRepository(pool).searchRecordings(TENANT, 'hello', {}, 10);
    expect(result).toHaveLength(1);
    expect(result[0]!.artifact_id).toBe('rec-1');
  });

  it('searchRecordings with all filters adds conditions', async () => {
    const pool = makePool([]);
    await new SupervisorArtifactSearchRepository(pool).searchRecordings(TENANT, 'hello', { from_date: '2026-01-01', to_date: '2026-12-31', call_id: 'call-1' }, 5);
    const call = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(call[1]).toContain('2026-01-01');
    expect(call[1]).toContain('call-1');
  });

  it('searchRecordings escapes special LIKE characters', async () => {
    const pool = makePool([]);
    await new SupervisorArtifactSearchRepository(pool).searchRecordings(TENANT, 'he%llo_world', {}, 10);
    const call = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const params = call[1] as unknown[];
    const likeParam = params[params.length - 1] as string;
    expect(likeParam).toContain('\\%');
    expect(likeParam).toContain('\\_');
  });

  it('searchNotes returns matching notes', async () => {
    const pool = makePool([baseNote]);
    const result = await new SupervisorArtifactSearchRepository(pool).searchNotes(TENANT, 'hello', {}, 10);
    expect(result).toHaveLength(1);
    expect(result[0]!.content).toBe('hello world');
  });

  it('searchNotes with all filters adds conditions', async () => {
    const pool = makePool([]);
    await new SupervisorArtifactSearchRepository(pool).searchNotes(TENANT, 'hello', { call_id: 'call-1', from_date: '2026-01-01' }, 5);
    const call = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(call[1]).toContain('call-1');
    expect(call[1]).toContain('2026-01-01');
  });

  it('searchNotes returns empty array when no matches', async () => {
    const pool = makePool([]);
    expect(await new SupervisorArtifactSearchRepository(pool).searchNotes(TENANT, 'nothing', {}, 10)).toHaveLength(0);
  });

  it('searchDispositions returns matching dispositions', async () => {
    const pool = makePool([baseDisposition]);
    const result = await new SupervisorArtifactSearchRepository(pool).searchDispositions(TENANT, 'RESOLVED', {}, 10);
    expect(result).toHaveLength(1);
    expect(result[0]!.code).toBe('RESOLVED');
  });

  it('searchDispositions with all filters adds conditions', async () => {
    const pool = makePool([]);
    await new SupervisorArtifactSearchRepository(pool).searchDispositions(TENANT, 'RESOLVED', { call_id: 'call-1', from_date: '2026-01-01', to_date: '2026-12-31' }, 5);
    const call = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(call[1]).toContain('call-1');
    expect(call[1]).toContain('2026-01-01');
    expect(call[1]).toContain('2026-12-31');
  });

  it('searchDispositions returns empty array when no matches', async () => {
    const pool = makePool([]);
    expect(await new SupervisorArtifactSearchRepository(pool).searchDispositions(TENANT, 'nothing', {}, 10)).toHaveLength(0);
  });
});
