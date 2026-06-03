import { describe, expect, it, vi } from 'vitest';
import { RetentionPurgeService, type Queryable, type RetentionDefaults } from './retention-purge.service.js';
import type { StorageBackend } from './storage-backend.js';

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

function makeStorage(failPaths: string[] = []): StorageBackend & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async delete(path: string): Promise<boolean> {
      calls.push(path);
      return !failPaths.includes(path);
    },
  };
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
    // policy load + 1 count query (no storage path collection in dry-run)
    expect(db.query).toHaveBeenCalledTimes(2);
    expect(db.query.mock.calls[1][0]).toContain('SELECT COUNT(*)::text AS count');
    expect(db.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO tenant_audit_log'))).toBe(false);
  });

  it('purges recording rows: collects paths, deletes from DB, deletes from storage, writes audit', async () => {
    const db = makeDb([
      [tenantPolicy({ recording_retention_days: 10 })],
      // collectStoragePaths → 2 paths
      [{ storage_path: '/data/rec-a.wav' }, { storage_path: '/data/rec-b.wav' }],
      // purgeEligible → 2 rows deleted
      [{ count: '2' }],
      // auditDeletion → empty
      [],
    ]);
    const storage = makeStorage();

    const service = new RetentionPurgeService(db, defaults, storage);
    const result = await service.run({ dryRun: false, now, actorId: 'worker:test' });

    expect(result.results).toEqual([{
      tenant_id: 'tenant-1',
      category: 'recording',
      retention_days: 10,
      cutoff: '2026-05-23T00:00:00.000Z',
      record_count: 2,
      dry_run: false,
    }]);

    // Both files were deleted from storage
    expect(storage.calls).toEqual(['/data/rec-a.wav', '/data/rec-b.wav']);

    // Audit event written
    const auditCalls = db.query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO tenant_audit_log'));
    expect(auditCalls).toHaveLength(1);
    const metadata = JSON.parse(auditCalls[0][1][5] as string);
    expect(metadata.record_count).toBe(2);
    expect(metadata.dry_run).toBe(false);
  });

  it('records storage_delete_failures in result and audit when storage deletion fails', async () => {
    const db = makeDb([
      [tenantPolicy({ recording_retention_days: 10 })],
      [{ storage_path: '/data/rec-a.wav' }, { storage_path: '/data/rec-missing.wav' }],
      [{ count: '2' }],
      [],
    ]);
    // rec-missing.wav fails to delete
    const storage = makeStorage(['/data/rec-missing.wav']);

    const service = new RetentionPurgeService(db, defaults, storage);
    const result = await service.run({ dryRun: false, now });

    expect(result.results[0]?.storage_delete_failures).toBe(1);

    // Failure count included in audit metadata
    const auditCalls = db.query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO tenant_audit_log'));
    const metadata = JSON.parse(auditCalls[0][1][5] as string);
    expect(metadata.storage_delete_failures).toBe(1);
  });

  it('storage failure does not prevent DB purge or audit event', async () => {
    const db = makeDb([
      [tenantPolicy({ recording_retention_days: 10 })],
      [{ storage_path: '/data/rec-fail.wav' }],
      [{ count: '1' }],
      [],
    ]);
    const storage = makeStorage(['/data/rec-fail.wav']);

    const service = new RetentionPurgeService(db, defaults, storage);
    const result = await service.run({ dryRun: false, now });

    // DB record still purged
    expect(result.results[0]?.record_count).toBe(1);
    // Audit event still written
    const auditCalls = db.query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO tenant_audit_log'));
    expect(auditCalls).toHaveLength(1);
  });

  it('purges eligible rows and writes one audit event per category with deletions', async () => {
    const db = makeDb([
      [tenantPolicy({ recording_retention_days: 10, transcript_retention_days: 30 })],
      // recording: collectStoragePaths → empty (no files for simplicity)
      [],
      // recording: purgeEligible → 3
      [{ count: '3' }],
      // recording: audit
      [],
      // transcript: purgeEligible → 0 (no storage path collection for transcript)
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
    const metadata = JSON.parse(auditCalls[0][1][5] as string);
    expect(metadata).toMatchObject({
      record_count: 3,
      cutoff: '2026-05-23T00:00:00.000Z',
      retention_days: 10,
      dry_run: false,
    });
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
      // recording: collectStoragePaths
      [{ count: '1' }],
      // recording: purgeEligible
      [{ count: '1' }],
      // recording: audit
      [],
      // voicemail: collectStoragePaths
      [{ count: '1' }],
      // voicemail: purgeEligible
      [{ count: '1' }],
      // voicemail: audit
      [],
      [{ count: '1' }],
      [{ count: '1' }],
      [{ count: '1' }],
      [{ count: '1' }],
      [{ count: '1' }],
    ]);

    const service = new RetentionPurgeService(db, defaults);
    const result = await service.run({ dryRun: false, now });

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
      // recording: collectStoragePaths
      [],
      // recording: purgeEligible
      [{ count: '0' }],
      // voicemail: collectStoragePaths
      [],
      // voicemail: purgeEligible
      [{ count: '0' }],
      // cdr: purgeEligible
      [{ count: '0' }],
    ]);

    const service = new RetentionPurgeService(db, defaults);
    await service.run({ dryRun: false, now });

    const allSql = db.query.mock.calls.slice(1).map(([sql]) => String(sql)).join('\n');
    expect(allSql).toContain('FROM legal_hold_requests');
    expect(allSql).toContain("h.status = 'active'");
    expect(allSql).toContain("h.resource_type = 'recording'");
    expect(allSql).toContain("h.resource_type = 'voicemail'");
    expect(allSql).toContain("h.resource_type = 'cdr'");
    expect(allSql).not.toContain("h.status = 'released'");
  });
});
