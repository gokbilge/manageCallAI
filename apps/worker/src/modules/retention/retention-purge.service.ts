export type RetentionCategory =
  | 'recording'
  | 'voicemail'
  | 'transcript'
  | 'summary'
  | 'cdr'
  | 'call_event'
  | 'generated_media';

export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<{ rows: T[] }>;
}

export interface RetentionDefaults {
  recordingDays: number | null;
  voicemailDays: number | null;
  transcriptDays: number | null;
  summaryDays: number | null;
  cdrDays: number | null;
  callEventDays: number | null;
  generatedMediaDays: number | null;
}

export interface RetentionPurgeOptions {
  dryRun: boolean;
  now?: Date;
  actorId?: string | null;
}

export interface RetentionPurgeCategoryResult {
  tenant_id: string;
  category: RetentionCategory;
  retention_days: number;
  cutoff: string;
  record_count: number;
  dry_run: boolean;
}

export interface RetentionPurgeResult {
  dry_run: boolean;
  started_at: string;
  finished_at: string;
  results: RetentionPurgeCategoryResult[];
}

type TenantPolicyRow = {
  tenant_id: string;
  recording_retention_days: number | null;
  voicemail_retention_days: number | null;
  transcript_retention_days: number | null;
  ai_summary_retention_days: number | null;
  cdr_retention_days: number | null;
  call_event_retention_days: number | null;
  generated_media_retention_days: number | null;
};

type CategoryPlan = {
  category: RetentionCategory;
  days: number | null;
};

const SYSTEM_ACTOR_ROLE = 'system';
const SYSTEM_ACTION = 'retention.purge';

export const PRODUCTION_RETENTION_DEFAULTS: RetentionDefaults = {
  recordingDays: 365,
  voicemailDays: 365,
  transcriptDays: 180,
  summaryDays: 180,
  cdrDays: 730,
  callEventDays: 365,
  generatedMediaDays: 180,
};

export class RetentionPurgeService {
  constructor(
    private readonly db: Queryable,
    private readonly defaults: RetentionDefaults = PRODUCTION_RETENTION_DEFAULTS,
  ) {}

  async run(options: RetentionPurgeOptions): Promise<RetentionPurgeResult> {
    const startedAt = options.now ?? new Date();
    const policies = await this.loadTenantPolicies();
    const results: RetentionPurgeCategoryResult[] = [];

    for (const policy of policies) {
      for (const plan of this.buildPlans(policy)) {
        if (plan.days == null) continue;
        const cutoff = subtractDays(startedAt, plan.days);
        const recordCount = options.dryRun
          ? await this.countEligible(policy.tenant_id, plan.category, cutoff)
          : await this.purgeEligible(policy.tenant_id, plan.category, cutoff);

        const result = {
          tenant_id: policy.tenant_id,
          category: plan.category,
          retention_days: plan.days,
          cutoff: cutoff.toISOString(),
          record_count: recordCount,
          dry_run: options.dryRun,
        };
        results.push(result);

        if (!options.dryRun && recordCount > 0) {
          await this.auditDeletion(result, options.actorId ?? null);
        }
      }
    }

    return {
      dry_run: options.dryRun,
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      results,
    };
  }

  private async loadTenantPolicies(): Promise<TenantPolicyRow[]> {
    const rows = await this.db.query<TenantPolicyRow>(
      `SELECT t.id AS tenant_id,
              CASE WHEN p.tenant_id IS NULL THEN $1::int ELSE p.recording_retention_days END AS recording_retention_days,
              CASE WHEN p.tenant_id IS NULL THEN $2::int ELSE p.voicemail_retention_days END AS voicemail_retention_days,
              CASE WHEN p.tenant_id IS NULL THEN $3::int ELSE p.transcript_retention_days END AS transcript_retention_days,
              CASE WHEN p.tenant_id IS NULL THEN $4::int ELSE p.ai_summary_retention_days END AS ai_summary_retention_days,
              CASE WHEN p.tenant_id IS NULL THEN $5::int ELSE p.cdr_retention_days END AS cdr_retention_days,
              CASE WHEN p.tenant_id IS NULL THEN $6::int ELSE p.call_event_retention_days END AS call_event_retention_days,
              CASE WHEN p.tenant_id IS NULL THEN $7::int ELSE p.generated_media_retention_days END AS generated_media_retention_days
       FROM tenants t
       LEFT JOIN tenant_retention_policies p ON p.tenant_id = t.id
       WHERE t.status = 'active'
       ORDER BY t.id`,
      [
        this.defaults.recordingDays,
        this.defaults.voicemailDays,
        this.defaults.transcriptDays,
        this.defaults.summaryDays,
        this.defaults.cdrDays,
        this.defaults.callEventDays,
        this.defaults.generatedMediaDays,
      ],
    );
    return rows.rows;
  }

  private buildPlans(policy: TenantPolicyRow): CategoryPlan[] {
    return [
      { category: 'recording', days: policy.recording_retention_days },
      { category: 'voicemail', days: policy.voicemail_retention_days },
      { category: 'transcript', days: policy.transcript_retention_days },
      { category: 'summary', days: policy.ai_summary_retention_days },
      { category: 'cdr', days: policy.cdr_retention_days },
      { category: 'call_event', days: policy.call_event_retention_days },
      { category: 'generated_media', days: policy.generated_media_retention_days },
    ];
  }

  private async countEligible(tenantId: string, category: RetentionCategory, cutoff: Date): Promise<number> {
    const result = await this.db.query<{ count: string }>(this.queryFor(category, true), [tenantId, cutoff.toISOString()]);
    return Number.parseInt(result.rows[0]?.count ?? '0', 10);
  }

  private async purgeEligible(tenantId: string, category: RetentionCategory, cutoff: Date): Promise<number> {
    const result = await this.db.query<{ count: string }>(this.queryFor(category, false), [tenantId, cutoff.toISOString()]);
    return Number.parseInt(result.rows[0]?.count ?? '0', 10);
  }

  private queryFor(category: RetentionCategory, dryRun: boolean): string {
    switch (category) {
      case 'recording':
        return dryRun ? countRecordingsSql : purgeRecordingsSql;
      case 'voicemail':
        return dryRun ? countVoicemailSql : purgeVoicemailSql;
      case 'transcript':
        return dryRun ? countTranscriptsSql : purgeTranscriptsSql;
      case 'summary':
        return dryRun ? countSummariesSql : purgeSummariesSql;
      case 'cdr':
        return dryRun ? countCdrsSql : purgeCdrsSql;
      case 'call_event':
        return dryRun ? countCallEventsSql : purgeCallEventsSql;
      case 'generated_media':
        return dryRun ? countGeneratedMediaSql : purgeGeneratedMediaSql;
    }
  }

  private async auditDeletion(result: RetentionPurgeCategoryResult, actorId: string | null): Promise<void> {
    await this.db.query(
      `INSERT INTO tenant_audit_log
         (tenant_id, actor_id, actor_role, action, resource_type, resource_id, metadata_json)
       VALUES ($1, $2, $3, $4, $5, NULL, $6::jsonb)`,
      [
        result.tenant_id,
        actorId,
        SYSTEM_ACTOR_ROLE,
        SYSTEM_ACTION,
        result.category,
        JSON.stringify({
          record_count: result.record_count,
          cutoff: result.cutoff,
          retention_days: result.retention_days,
          dry_run: false,
        }),
      ],
    );
  }
}

function subtractDays(now: Date, days: number): Date {
  return new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
}

const recordingHoldWhere = `
  NOT EXISTS (
    SELECT 1 FROM legal_hold_requests h
    WHERE h.tenant_id = r.tenant_id
      AND h.status = 'active'
      AND (h.resource_type = 'all'
        OR (h.resource_type = 'recording' AND (h.resource_id IS NULL OR h.resource_id = r.id::text OR h.resource_id = r.call_id)))
  )`;

const countRecordingsSql = `
  SELECT COUNT(*)::text AS count
  FROM call_recordings r
  WHERE r.tenant_id = $1
    AND r.status <> 'deleted'
    AND COALESCE(r.retain_until, r.recorded_at) < $2::timestamptz
    AND ${recordingHoldWhere}`;

const purgeRecordingsSql = `
  WITH purged AS (
    UPDATE call_recordings r
       SET status = 'deleted',
           deleted_at = NOW(),
           delete_reason = 'retention_policy'
     WHERE r.tenant_id = $1
       AND r.status <> 'deleted'
       AND COALESCE(r.retain_until, r.recorded_at) < $2::timestamptz
       AND ${recordingHoldWhere}
     RETURNING 1
  )
  SELECT COUNT(*)::text AS count FROM purged`;

const voicemailHoldWhere = `
  NOT EXISTS (
    SELECT 1 FROM legal_hold_requests h
    WHERE h.tenant_id = v.tenant_id
      AND h.status = 'active'
      AND (h.resource_type = 'all'
        OR (h.resource_type = 'voicemail' AND (h.resource_id IS NULL OR h.resource_id = v.id::text OR h.resource_id = v.call_id)))
  )`;

const countVoicemailSql = `
  SELECT COUNT(*)::text AS count
  FROM voicemail_messages v
  WHERE v.tenant_id = $1
    AND v.deleted_at IS NULL
    AND v.recorded_at < $2::timestamptz
    AND ${voicemailHoldWhere}`;

const purgeVoicemailSql = `
  WITH purged AS (
    UPDATE voicemail_messages v
       SET deleted_at = NOW()
     WHERE v.tenant_id = $1
       AND v.deleted_at IS NULL
       AND v.recorded_at < $2::timestamptz
       AND ${voicemailHoldWhere}
     RETURNING 1
  )
  SELECT COUNT(*)::text AS count FROM purged`;

const transcriptHoldWhere = `
  NOT EXISTS (
    SELECT 1 FROM legal_hold_requests h
    WHERE h.tenant_id = a.tenant_id
      AND h.status = 'active'
      AND (h.resource_type = 'all'
        OR (h.resource_type = 'transcript' AND (h.resource_id IS NULL OR h.resource_id = a.id::text OR h.resource_id = a.recording_id::text))
        OR (h.resource_type = 'recording' AND h.resource_id = a.recording_id::text))
  )`;

const countTranscriptsSql = `
  SELECT COUNT(*)::text AS count
  FROM recording_analysis_requests a
  WHERE a.tenant_id = $1
    AND a.transcript_text IS NOT NULL
    AND COALESCE(a.completed_at, a.created_at) < $2::timestamptz
    AND ${transcriptHoldWhere}`;

const purgeTranscriptsSql = `
  WITH purged AS (
    UPDATE recording_analysis_requests a
       SET transcript_text = NULL
     WHERE a.tenant_id = $1
       AND a.transcript_text IS NOT NULL
       AND COALESCE(a.completed_at, a.created_at) < $2::timestamptz
       AND ${transcriptHoldWhere}
     RETURNING 1
  )
  SELECT COUNT(*)::text AS count FROM purged`;

const summaryHoldWhere = `
  NOT EXISTS (
    SELECT 1 FROM legal_hold_requests h
    WHERE h.tenant_id = a.tenant_id
      AND h.status = 'active'
      AND (h.resource_type = 'all'
        OR (h.resource_type = 'summary' AND (h.resource_id IS NULL OR h.resource_id = a.id::text OR h.resource_id = a.recording_id::text))
        OR (h.resource_type = 'recording' AND h.resource_id = a.recording_id::text))
  )`;

const countSummariesSql = `
  SELECT COUNT(*)::text AS count
  FROM recording_analysis_requests a
  WHERE a.tenant_id = $1
    AND a.summary_text IS NOT NULL
    AND COALESCE(a.completed_at, a.created_at) < $2::timestamptz
    AND ${summaryHoldWhere}`;

const purgeSummariesSql = `
  WITH purged AS (
    UPDATE recording_analysis_requests a
       SET summary_text = NULL
     WHERE a.tenant_id = $1
       AND a.summary_text IS NOT NULL
       AND COALESCE(a.completed_at, a.created_at) < $2::timestamptz
       AND ${summaryHoldWhere}
     RETURNING 1
  )
  SELECT COUNT(*)::text AS count FROM purged`;

const cdrHoldWhere = `
  NOT EXISTS (
    SELECT 1 FROM legal_hold_requests h
    WHERE h.tenant_id = c.tenant_id
      AND h.status = 'active'
      AND (h.resource_type = 'all'
        OR (h.resource_type = 'cdr' AND (h.resource_id IS NULL OR h.resource_id = c.id::text OR h.resource_id = c.call_id)))
  )`;

const countCdrsSql = `
  SELECT COUNT(*)::text AS count
  FROM call_detail_records c
  WHERE c.tenant_id = $1
    AND c.start_time < $2::timestamptz
    AND ${cdrHoldWhere}`;

const purgeCdrsSql = `
  WITH purged AS (
    DELETE FROM call_detail_records c
     WHERE c.tenant_id = $1
       AND c.start_time < $2::timestamptz
       AND ${cdrHoldWhere}
     RETURNING 1
  )
  SELECT COUNT(*)::text AS count FROM purged`;

const callEventHoldWhere = `
  NOT EXISTS (
    SELECT 1 FROM legal_hold_requests h
    WHERE h.tenant_id = e.tenant_id
      AND h.status = 'active'
      AND (h.resource_type = 'all'
        OR (h.resource_type = 'call_event' AND (h.resource_id IS NULL OR h.resource_id = e.id::text OR h.resource_id = e.call_id)))
  )`;

const countCallEventsSql = `
  SELECT COUNT(*)::text AS count
  FROM call_events e
  WHERE e.tenant_id = $1
    AND e.event_time < $2::timestamptz
    AND ${callEventHoldWhere}`;

const purgeCallEventsSql = `
  WITH purged AS (
    DELETE FROM call_events e
     WHERE e.tenant_id = $1
       AND e.event_time < $2::timestamptz
       AND ${callEventHoldWhere}
     RETURNING 1
  )
  SELECT COUNT(*)::text AS count FROM purged`;

const generatedMediaHoldWhere = `
  NOT EXISTS (
    SELECT 1 FROM legal_hold_requests h
    WHERE h.tenant_id = p.tenant_id
      AND h.status = 'active'
      AND (h.resource_type = 'all'
        OR (h.resource_type = 'generated_media' AND (h.resource_id IS NULL OR h.resource_id = p.id::text OR h.resource_id = p.generated_prompt_asset_id::text)))
  )`;

const countGeneratedMediaSql = `
  SELECT COUNT(*)::text AS count
  FROM prompt_generation_requests p
  WHERE p.tenant_id = $1
    AND p.media_reference IS NOT NULL
    AND COALESCE(p.completed_at, p.created_at) < $2::timestamptz
    AND ${generatedMediaHoldWhere}`;

const purgeGeneratedMediaSql = `
  WITH purged AS (
    UPDATE prompt_generation_requests p
       SET media_reference = NULL
     WHERE p.tenant_id = $1
       AND p.media_reference IS NOT NULL
       AND COALESCE(p.completed_at, p.created_at) < $2::timestamptz
       AND ${generatedMediaHoldWhere}
     RETURNING 1
  )
  SELECT COUNT(*)::text AS count FROM purged`;
