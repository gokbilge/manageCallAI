import type { Pool } from 'pg';
import type { LiveSnapshot, QueueDepth, RunningSession, WebhookBacklog } from './observability.types.js';

export class ObservabilityRepository {
  constructor(private readonly db: Pool) {}

  async getSnapshot(tenantId: string): Promise<LiveSnapshot> {
    const [sessions, queueDepths, webhookBacklog, counters] = await Promise.all([
      this.getRunningSessions(tenantId),
      this.getQueueDepths(tenantId),
      this.getWebhookBacklog(tenantId),
      this.getCounters(tenantId),
    ]);

    return {
      tenant_id: tenantId,
      active_session_count: sessions.length,
      running_sessions: sessions,
      queue_depths: queueDepths,
      webhook_backlog: webhookBacklog,
      recent_call_events_5m: counters.recent_call_events_5m,
      recent_session_failures_1h: counters.recent_session_failures_1h,
      pending_approvals: counters.pending_approvals,
      generated_at: new Date().toISOString(),
    };
  }

  private async getRunningSessions(tenantId: string): Promise<RunningSession[]> {
    const result = await this.db.query<RunningSession & { started_at: unknown }>(
      `SELECT id, call_id, flow_id, caller_number, current_node_id,
              created_at::text AS started_at
       FROM ivr_flow_sessions
       WHERE tenant_id = $1 AND status = 'running'
       ORDER BY created_at DESC
       LIMIT 20`,
      [tenantId],
    );
    return result.rows as RunningSession[];
  }

  private async getQueueDepths(tenantId: string): Promise<QueueDepth[]> {
    const result = await this.db.query<QueueDepth>(
      `SELECT q.id AS queue_id, q.name AS queue_name,
              COUNT(qm.id)::int AS member_count
       FROM queues q
       LEFT JOIN queue_members qm ON qm.queue_id = q.id
       WHERE q.tenant_id = $1 AND q.status = 'active'
       GROUP BY q.id, q.name
       ORDER BY q.name`,
      [tenantId],
    );
    return result.rows;
  }

  private async getWebhookBacklog(tenantId: string): Promise<WebhookBacklog> {
    const result = await this.db.query<{
      status: string;
      cnt: string;
    }>(
      `SELECT status, COUNT(*)::text AS cnt
       FROM webhook_delivery_queue
       WHERE tenant_id = $1
         AND dismissed_at IS NULL
         AND status IN ('pending', 'processing', 'failed', 'abandoned')
       GROUP BY status`,
      [tenantId],
    );

    const counts: Record<string, number> = {};
    for (const row of result.rows) {
      counts[row.status] = parseInt(row.cnt, 10);
    }

    return {
      pending: counts['pending'] ?? 0,
      processing: counts['processing'] ?? 0,
      failed: counts['failed'] ?? 0,
      abandoned: counts['abandoned'] ?? 0,
    };
  }

  private async getCounters(tenantId: string): Promise<{
    recent_call_events_5m: number;
    recent_session_failures_1h: number;
    pending_approvals: number;
  }> {
    const result = await this.db.query<{
      recent_call_events_5m: string;
      recent_session_failures_1h: string;
      pending_approvals: string;
    }>(
      `SELECT
         (SELECT COUNT(*)::text FROM call_events
          WHERE tenant_id = $1 AND event_time >= NOW() - INTERVAL '5 minutes') AS recent_call_events_5m,
         (SELECT COUNT(*)::text FROM ivr_flow_sessions
          WHERE tenant_id = $1 AND status = 'failed'
            AND created_at >= NOW() - INTERVAL '1 hour') AS recent_session_failures_1h,
         (SELECT COUNT(*)::text FROM approval_requests
          WHERE tenant_id = $1 AND status = 'pending') AS pending_approvals`,
      [tenantId],
    );

    const row = result.rows[0]!;
    return {
      recent_call_events_5m: parseInt(row.recent_call_events_5m, 10),
      recent_session_failures_1h: parseInt(row.recent_session_failures_1h, 10),
      pending_approvals: parseInt(row.pending_approvals, 10),
    };
  }
}
