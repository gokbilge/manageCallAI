import type { Pool } from 'pg';
import type { AgentSummary, QueueStat, SlaMetric } from './supervisor-dashboard.types.js';

export class SupervisorDashboardRepository {
  constructor(private readonly db: Pool) {}

  async getQueueStats(tenantId: string): Promise<QueueStat[]> {
    const r = await this.db.query<QueueStat>(
      `SELECT
         q.id AS queue_id,
         q.name AS queue_name,
         q.strategy,
         q.status,
         COUNT(qm.id)::int AS member_count,
         q.max_wait_seconds AS sla_target_seconds,
         COALESCE(cb.pending_count, 0)::int AS pending_callbacks
       FROM queues q
       LEFT JOIN queue_members qm ON qm.queue_id = q.id
       LEFT JOIN (
         SELECT queue_id, COUNT(*) AS pending_count
         FROM queue_callbacks
         WHERE tenant_id = $1 AND status IN ('pending', 'scheduled')
         GROUP BY queue_id
       ) cb ON cb.queue_id = q.id
       WHERE q.tenant_id = $1
       GROUP BY q.id, q.name, q.strategy, q.status, q.max_wait_seconds, cb.pending_count
       ORDER BY q.name`,
      [tenantId],
    );
    return r.rows;
  }

  async getAgentSummaries(tenantId: string): Promise<AgentSummary[]> {
    const r = await this.db.query<AgentSummary>(
      `SELECT
         ap.id AS agent_profile_id,
         ap.display_name,
         aa.state,
         aa.reason,
         COUNT(DISTINCT qm.queue_id)::int AS queue_count
       FROM agent_profiles ap
       LEFT JOIN agent_availability aa ON aa.agent_profile_id = ap.id AND aa.tenant_id = ap.tenant_id
       LEFT JOIN extensions e ON e.owner_user_id = ap.user_id AND e.tenant_id = ap.tenant_id
       LEFT JOIN queue_members qm ON qm.extension_id = e.id
       WHERE ap.tenant_id = $1 AND ap.status = 'active'
       GROUP BY ap.id, ap.display_name, aa.state, aa.reason
       ORDER BY ap.display_name`,
      [tenantId],
    );
    return r.rows;
  }

  async getSlaMetrics(tenantId: string): Promise<SlaMetric[]> {
    const r = await this.db.query<SlaMetric>(
      `SELECT
         q.id AS queue_id,
         q.name AS queue_name,
         q.max_wait_seconds AS sla_target_seconds,
         COALESCE(SUM(CASE WHEN cb.status = 'pending' THEN 1 ELSE 0 END), 0)::int AS pending_callbacks,
         COALESCE(SUM(CASE WHEN cb.status = 'scheduled' THEN 1 ELSE 0 END), 0)::int AS scheduled_callbacks,
         COALESCE(SUM(CASE WHEN cb.status = 'reached' THEN 1 ELSE 0 END), 0)::int AS reached_callbacks,
         COALESCE(SUM(CASE WHEN cb.status = 'expired' THEN 1 ELSE 0 END), 0)::int AS expired_callbacks
       FROM queues q
       LEFT JOIN queue_callbacks cb ON cb.queue_id = q.id AND cb.tenant_id = q.tenant_id
       WHERE q.tenant_id = $1
       GROUP BY q.id, q.name, q.max_wait_seconds
       ORDER BY q.name`,
      [tenantId],
    );
    return r.rows;
  }
}
