import type { Pool } from 'pg';
import type { PlatformRuntimeSummary, TenantSummary } from './platform.types.js';

export class PlatformRepository {
  constructor(private readonly db: Pool) {}

  async listTenants(): Promise<TenantSummary[]> {
    const result = await this.db.query<TenantSummary>(
      `SELECT id, name, slug, directory_domain, status, created_at, updated_at
       FROM tenants
       ORDER BY created_at DESC`,
    );
    return result.rows;
  }

  async getRuntimeSummary(): Promise<PlatformRuntimeSummary> {
    const result = await this.db.query<PlatformRuntimeSummary>(
      `SELECT
         (SELECT COUNT(*)::int FROM ivr_flow_sessions WHERE status = 'running') AS active_sessions,
         (SELECT COUNT(*)::int FROM ivr_flow_sessions WHERE status = 'completed' AND created_at >= NOW() - INTERVAL '24 hours') AS completed_sessions_24h,
         (SELECT COUNT(*)::int FROM ivr_flow_sessions WHERE status = 'failed' AND created_at >= NOW() - INTERVAL '24 hours') AS failed_sessions_24h,
         (SELECT COUNT(*)::int FROM call_events WHERE event_time >= NOW() - INTERVAL '24 hours') AS call_events_24h,
         (SELECT COUNT(*)::int FROM runtime_ingestion_records WHERE status = 'failed' AND received_at >= NOW() - INTERVAL '24 hours') AS failed_runtime_ingestions_24h,
         (SELECT COUNT(*)::int FROM approval_requests WHERE status = 'pending') AS pending_approvals`,
    );
    return result.rows[0]!;
  }
}
