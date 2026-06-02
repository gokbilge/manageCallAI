import type { Pool } from 'pg';
import type {
  AlertListFilter,
  AlertRuleListFilter,
  AlertSeverity,
  AlertType,
  CreateAlertRuleInput,
  LiveSnapshot,
  PlatformRuntimeSummary,
  QueueDepth,
  RunningSession,
  SecurityAlertInstance,
  SecurityAlertRule,
  UpdateAlertRuleInput,
  WebhookBacklog,
} from './observability.types.js';

export class ObservabilityRepository {
  constructor(private readonly db: Pool) {}

  async getSnapshot(tenantId: string): Promise<LiveSnapshot> {
    const [sessions, queueDepths, webhookBacklog, counters, freeswitchNodes] = await Promise.all([
      this.getRunningSessions(tenantId),
      this.getQueueDepths(tenantId),
      this.getWebhookBacklog(tenantId),
      this.getCounters(tenantId),
      this.getFreeswitchNodeHealth(),
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
      freeswitch_nodes: freeswitchNodes,
      generated_at: new Date().toISOString(),
    };
  }

  private async getFreeswitchNodeHealth(): Promise<{ active: number; total: number }> {
    const result = await this.db.query<{ active: string; total: string }>(
      `SELECT COUNT(*) FILTER (WHERE status = 'active')::text AS active,
              COUNT(*) FILTER (WHERE status != 'decommissioned')::text AS total
       FROM freeswitch_nodes`,
    );
    const row = result.rows[0];
    return {
      active: parseInt(row?.active ?? '0', 10),
      total: parseInt(row?.total ?? '0', 10),
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

  // ── SLICE-48: Security alert rules ───────────────────────────────────────

  async listAlertRules(tenantId: string, filter: AlertRuleListFilter): Promise<SecurityAlertRule[]> {
    const conditions = ['tenant_id = $1', "status != 'archived'"];
    const values: unknown[] = [tenantId];
    let idx = 2;

    if (filter.alert_type) {
      conditions.push(`alert_type = $${idx++}`);
      values.push(filter.alert_type);
    }
    if (filter.status) {
      conditions[1] = `status = $${idx++}`;
      values.push(filter.status);
    }

    const result = await this.db.query<SecurityAlertRule>(
      `SELECT id, tenant_id, name, description, alert_type, conditions, severity, status,
              created_by, created_at, updated_at
       FROM security_alert_rules
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC`,
      values,
    );
    return result.rows;
  }

  async createAlertRule(tenantId: string, createdBy: string, input: CreateAlertRuleInput): Promise<SecurityAlertRule> {
    const result = await this.db.query<SecurityAlertRule>(
      `INSERT INTO security_alert_rules
         (tenant_id, name, description, alert_type, conditions, severity, status, created_by)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
       RETURNING id, tenant_id, name, description, alert_type, conditions, severity, status,
                 created_by, created_at, updated_at`,
      [
        tenantId,
        input.name,
        input.description ?? null,
        input.alert_type,
        JSON.stringify(input.conditions),
        input.severity ?? 'warning',
        input.status ?? 'active',
        createdBy,
      ],
    );
    return result.rows[0]!;
  }

  async updateAlertRule(id: string, tenantId: string, input: UpdateAlertRuleInput): Promise<SecurityAlertRule | null> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [id, tenantId];
    let idx = 3;

    if (input.name !== undefined) { setClauses.push(`name = $${idx++}`); values.push(input.name); }
    if (input.description !== undefined) { setClauses.push(`description = $${idx++}`); values.push(input.description ?? null); }
    if (input.conditions !== undefined) { setClauses.push(`conditions = $${idx++}::jsonb`); values.push(JSON.stringify(input.conditions)); }
    if (input.severity !== undefined) { setClauses.push(`severity = $${idx++}`); values.push(input.severity); }
    if (input.status !== undefined) { setClauses.push(`status = $${idx++}`); values.push(input.status); }

    const result = await this.db.query<SecurityAlertRule>(
      `UPDATE security_alert_rules
       SET ${setClauses.join(', ')}
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, tenant_id, name, description, alert_type, conditions, severity, status,
                 created_by, created_at, updated_at`,
      values,
    );
    return result.rows[0] ?? null;
  }

  async deleteAlertRule(id: string, tenantId: string): Promise<boolean> {
    const result = await this.db.query<{ id: string }>(
      `UPDATE security_alert_rules SET status = 'archived', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2 AND status != 'archived'
       RETURNING id`,
      [id, tenantId],
    );
    return result.rows.length > 0;
  }

  // ── SLICE-48: Security alert instances ───────────────────────────────────

  async listAlerts(tenantId: string, filter: AlertListFilter): Promise<SecurityAlertInstance[]> {
    const conditions = ['tenant_id = $1'];
    const values: unknown[] = [tenantId];
    let idx = 2;

    if (filter.status) { conditions.push(`status = $${idx++}`); values.push(filter.status); }
    if (filter.severity) { conditions.push(`severity = $${idx++}`); values.push(filter.severity); }
    if (filter.since) { conditions.push(`fired_at >= $${idx++}::timestamptz`); values.push(filter.since); }

    const limit = Math.min(filter.limit ?? 100, 500);
    const result = await this.db.query<SecurityAlertInstance>(
      `SELECT id, tenant_id, rule_id, alert_type, severity, message, context_json, status,
              acknowledged_by, acknowledged_at, resolved_at, fired_at, created_at
       FROM security_alerts
       WHERE ${conditions.join(' AND ')}
       ORDER BY fired_at DESC
       LIMIT $${idx}`,
      [...values, limit],
    );
    return result.rows;
  }

  async createAlert(input: {
    tenant_id: string;
    rule_id: string;
    alert_type: AlertType;
    severity: AlertSeverity;
    message: string;
    context_json?: Record<string, unknown> | null;
  }): Promise<SecurityAlertInstance> {
    const result = await this.db.query<SecurityAlertInstance>(
      `INSERT INTO security_alerts
         (tenant_id, rule_id, alert_type, severity, message, context_json)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING id, tenant_id, rule_id, alert_type, severity, message, context_json, status,
                 acknowledged_by, acknowledged_at, resolved_at, fired_at, created_at`,
      [
        input.tenant_id,
        input.rule_id,
        input.alert_type,
        input.severity,
        input.message,
        input.context_json ? JSON.stringify(input.context_json) : null,
      ],
    );
    await this.db.query(
      `INSERT INTO security_alert_cooldowns (rule_id, tenant_id, last_fired_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (rule_id, tenant_id) DO UPDATE SET last_fired_at = NOW()`,
      [input.rule_id, input.tenant_id],
    );
    return result.rows[0]!;
  }

  async acknowledgeAlert(id: string, tenantId: string, userId: string): Promise<SecurityAlertInstance | null> {
    const result = await this.db.query<SecurityAlertInstance>(
      `UPDATE security_alerts
       SET status = 'acknowledged',
           acknowledged_by = $3,
           acknowledged_at = NOW()
       WHERE id = $1 AND tenant_id = $2 AND status = 'new'
       RETURNING id, tenant_id, rule_id, alert_type, severity, message, context_json, status,
                 acknowledged_by, acknowledged_at, resolved_at, fired_at, created_at`,
      [id, tenantId, userId],
    );
    return result.rows[0] ?? null;
  }

  async resolveAlert(id: string, tenantId: string): Promise<SecurityAlertInstance | null> {
    const result = await this.db.query<SecurityAlertInstance>(
      `UPDATE security_alerts
       SET status = 'resolved',
           resolved_at = NOW()
       WHERE id = $1 AND tenant_id = $2 AND status IN ('new', 'acknowledged')
       RETURNING id, tenant_id, rule_id, alert_type, severity, message, context_json, status,
                 acknowledged_by, acknowledged_at, resolved_at, fired_at, created_at`,
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async dismissAlert(id: string, tenantId: string): Promise<SecurityAlertInstance | null> {
    const result = await this.db.query<SecurityAlertInstance>(
      `UPDATE security_alerts
       SET status = 'dismissed'
       WHERE id = $1 AND tenant_id = $2 AND status NOT IN ('resolved', 'dismissed')
       RETURNING id, tenant_id, rule_id, alert_type, severity, message, context_json, status,
                 acknowledged_by, acknowledged_at, resolved_at, fired_at, created_at`,
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }

  // ── SLICE-48: Rule evaluation queries ────────────────────────────────────

  async countFailedSipRegistrations(tenantId: string, windowMinutes: number): Promise<number> {
    const result = await this.db.query<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM extension_event_log
       WHERE tenant_id = $1 AND event_type = 'auth_failed'
         AND created_at >= NOW() - ($2 || ' minutes')::interval`,
      [tenantId, windowMinutes],
    );
    return parseInt(result.rows[0]?.cnt ?? '0', 10);
  }

  async countRecentCallEvents(tenantId: string, windowMinutes: number, direction?: 'inbound' | 'outbound'): Promise<number> {
    const conditions = ['tenant_id = $1', `event_time >= NOW() - ($2 || ' minutes')::interval`];
    const values: unknown[] = [tenantId, windowMinutes];
    if (direction === 'outbound') {
      conditions.push(`event_type IN ('outbound_call_dispatched', 'outbound_call_completed', 'outbound_call_failed')`);
    }
    const result = await this.db.query<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM call_events WHERE ${conditions.join(' AND ')}`,
      values,
    );
    return parseInt(result.rows[0]?.cnt ?? '0', 10);
  }

  async countWebhookBacklog(tenantId: string): Promise<{ failed: number; abandoned: number }> {
    const result = await this.db.query<{ status: string; cnt: string }>(
      `SELECT status, COUNT(*)::text AS cnt
       FROM webhook_delivery_queue
       WHERE tenant_id = $1 AND dismissed_at IS NULL AND status IN ('failed', 'abandoned')
       GROUP BY status`,
      [tenantId],
    );
    const counts: Record<string, number> = {};
    for (const row of result.rows) { counts[row.status] = parseInt(row.cnt, 10); }
    return { failed: counts['failed'] ?? 0, abandoned: counts['abandoned'] ?? 0 };
  }

  async countOldAnalysisJobs(tenantId: string, ageMinutes: number): Promise<number> {
    const result = await this.db.query<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM recording_analysis_requests
       WHERE tenant_id = $1 AND status IN ('queued', 'processing')
         AND created_at <= NOW() - ($2 || ' minutes')::interval`,
      [tenantId, ageMinutes],
    );
    return parseInt(result.rows[0]?.cnt ?? '0', 10);
  }

  async isCooledDown(ruleId: string, tenantId: string, cooldownMinutes: number): Promise<boolean> {
    const result = await this.db.query<{ recent: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM security_alert_cooldowns
         WHERE rule_id = $1 AND tenant_id = $2
           AND last_fired_at >= NOW() - ($3 || ' minutes')::interval
       ) AS recent`,
      [ruleId, tenantId, cooldownMinutes],
    );
    return result.rows[0]?.recent ?? false;
  }

  async getPlatformRuntimeSummary(): Promise<PlatformRuntimeSummary> {
    const result = await this.db.query<{
      active_sessions: string;
      completed_sessions_24h: string;
      failed_sessions_24h: string;
    }>(
      `SELECT
         (SELECT COUNT(*)::text FROM ivr_flow_sessions WHERE status = 'running') AS active_sessions,
         (SELECT COUNT(*)::text FROM ivr_flow_sessions WHERE status = 'completed'
            AND created_at >= NOW() - INTERVAL '24 hours') AS completed_sessions_24h,
         (SELECT COUNT(*)::text FROM ivr_flow_sessions WHERE status = 'failed'
            AND created_at >= NOW() - INTERVAL '24 hours') AS failed_sessions_24h`,
    );
    const row = result.rows[0]!;
    return {
      active_sessions: parseInt(row.active_sessions, 10),
      completed_sessions_24h: parseInt(row.completed_sessions_24h, 10),
      failed_sessions_24h: parseInt(row.failed_sessions_24h, 10),
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
