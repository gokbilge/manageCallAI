import { describe, expect, it, vi } from 'vitest';
import { RetentionPurgeService, type Queryable, type RetentionDefaults } from './retention-purge.service.js';

const now = new Date('2026-06-02T00:00:00.000Z');

const defaults: RetentionDefaults = {
  recordingDays: 365,
  voicemailDays: 365,
  transcriptDays: 180,
  summaryDays: 180,
  cdrDays: 730,
  callEventDays: 365,
  generatedMediaDays: 180,
};

function tenantPolicy(overrides: Partial<Record<string, number | null>> = {}) {
  return {
    tenant_id: 'tenant-1',
    recording_retention_days: 10,
    voicemail_retention_days: null,
    transcript_retention_days: null,
    ai_summary_retention_days: null,
    cdr_retention_days: null,
    call_event_retention_days: null,
    generated_media_retention_days: null,
    ...overrides,
  };
}

type QueryMock = Queryable['query'] & ReturnType<typeof vi.fn>;

function makeDb(rowsByCall: Array<Array<Record<string, unknown>>>): Queryable & { query: QueryMock } {
  const query = vi.fn(async <T = Record<string, unknown>>() => ({
    rows: (rowsByCall.shift() ?? [{ count: '0' }]) as T[],
  })) as QueryMock;
  return { query };
}

describe('RetentionPurgeService', () => {
  it('dry-runs eligible categories without writing audit rows', async () => {
    const db = makeDb([
      [tenantPolicy()],
      [{ count: '2' }],
    ]);

    const service = new RetentionPurgeService(db, defaults);
    const result = await service.run({ dryRun: true, now });

    expect(result.dry_run).toBe(true);
    expect(result.results).toEqual([{
      tenant_id: 'tenant-1',
      category: 'recording',
      retention_days: 10,
      cutoff: '2026-05-23T00:00:00.000Z',
      record_count: 2,
      dry_run: true,
    }]);
    expect(db.query).toHaveBeenCalledTimes(2);
    expect(db.query.mock.calls[1][0]).toContain('SELECT COUNT(*)::text AS count');
    expect(db.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO tenant_audit_log'))).toBe(false);
  });

  it('purges eligible rows and writes one audit event per category with deletions', async () => {
    const db = makeDb([
      [tenantPolicy({ recording_retention_days: 10, transcript_retention_days: 30 })],
      [{ count: '3' }],
      [],
      [{ count: '0' }],
    ]);

    const service = new RetentionPurgeService(db, defaults);
    const result = await service.run({ dryRun: false, now, actorId: 'worker:test' });

    expect(result.results.map((item) => [item.category, item.record_count])).toEqual([
      ['recording', 3],
      ['transcript', 0],
    ]);
    const auditCalls = db.query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO tenant_audit_log'));
    expect(auditCalls).toHaveLength(1);
    expect(auditCalls[0][1]).toEqual([
      'tenant-1',
      'worker:test',
      'system',
      'retention.purge',
      'recording',
      JSON.stringify({
        record_count: 3,
        cutoff: '2026-05-23T00:00:00.000Z',
        retention_days: 10,
        dry_run: false,
      }),
    ]);
  });

  it('uses platform defaults only when the tenant has no policy row', async () => {
    const db = makeDb([
      [{
        tenant_id: 'tenant-default',
        recording_retention_days: defaults.recordingDays,
        voicemail_retention_days: defaults.voicemailDays,
        transcript_retention_days: defaults.transcriptDays,
        ai_summary_retention_days: defaults.summaryDays,
        cdr_retention_days: defaults.cdrDays,
        call_event_retention_days: defaults.callEventDays,
        generated_media_retention_days: defaults.generatedMediaDays,
      }],
      [{ count: '1' }],
      [{ count: '1' }],
      [{ count: '1' }],
      [{ count: '1' }],
      [{ count: '1' }],
      [{ count: '1' }],
      [{ count: '1' }],
    ]);

    const service = new RetentionPurgeService(db, defaults);
    const result = await service.run({ dryRun: true, now });

    expect(result.results.map((item) => item.category)).toEqual([
      'recording',
      'voicemail',
      'transcript',
      'summary',
      'cdr',
      'call_event',
      'generated_media',
    ]);
  });

  it('builds purge SQL that excludes active legal holds and ignores released holds', async () => {
    const db = makeDb([
      [tenantPolicy({ recording_retention_days: 10, voicemail_retention_days: 20, cdr_retention_days: 30 })],
      [{ count: '0' }],
      [{ count: '0' }],
      [{ count: '0' }],
    ]);

    const service = new RetentionPurgeService(db, defaults);
    await service.run({ dryRun: false, now });

    const purgeSql = db.query.mock.calls.slice(1).map(([sql]) => String(sql)).join('\n');
    expect(purgeSql).toContain('FROM legal_hold_requests');
    expect(purgeSql).toContain("h.status = 'active'");
    expect(purgeSql).toContain("h.resource_type = 'recording'");
    expect(purgeSql).toContain("h.resource_type = 'voicemail'");
    expect(purgeSql).toContain("h.resource_type = 'cdr'");
    expect(purgeSql).not.toContain("h.status = 'released'");
  });
});
