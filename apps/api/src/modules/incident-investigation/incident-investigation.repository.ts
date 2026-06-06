import type { Pool } from 'pg';
import type {
  CallEventRow,
  GatewayStatusRow,
  IncidentInvestigation,
  InvestigationCitation,
  InvestigationContext,
  RouteRow,
} from './incident-investigation.types.js';

const columns = `id, tenant_id, question, context_json as context, answer, citations, data_sources, is_advisory, created_by, created_at`;

export class IncidentInvestigationRepository {
  constructor(private readonly db: Pool) {}

  async create(
    tenantId: string,
    question: string,
    context: InvestigationContext,
    answer: string,
    citations: InvestigationCitation[],
    dataSources: string[],
    createdBy: string | null,
  ): Promise<IncidentInvestigation> {
    const result = await this.db.query<IncidentInvestigation>(
      `INSERT INTO incident_investigations
         (tenant_id, question, context_json, answer, citations, data_sources, created_by)
       VALUES ($1, $2, $3::jsonb, $4, $5::jsonb, $6, $7)
       RETURNING ${columns}`,
      [
        tenantId,
        question,
        JSON.stringify(context),
        answer,
        JSON.stringify(citations),
        dataSources,
        createdBy,
      ],
    );
    return result.rows[0]!;
  }

  async listByTenant(tenantId: string): Promise<IncidentInvestigation[]> {
    const result = await this.db.query<IncidentInvestigation>(
      `SELECT ${columns} FROM incident_investigations
       WHERE tenant_id = $1
       ORDER BY created_at DESC LIMIT 100`,
      [tenantId],
    );
    return result.rows;
  }

  async findById(id: string, tenantId: string): Promise<IncidentInvestigation | null> {
    const result = await this.db.query<IncidentInvestigation>(
      `SELECT ${columns} FROM incident_investigations WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }

  // ── Data gathering for investigation ─────────────────────────────────────

  async findCallEvents(callIds: string[], tenantId: string): Promise<CallEventRow[]> {
    if (callIds.length === 0) return [];
    const result = await this.db.query<CallEventRow>(
      `SELECT call_id, event_type, event_time, source, payload
       FROM call_events
       WHERE call_id = ANY($1) AND tenant_id = $2
       ORDER BY event_time ASC LIMIT 200`,
      [callIds, tenantId],
    );
    return result.rows;
  }

  async findCallEventsByTimeRange(tenantId: string, from: string, to: string): Promise<CallEventRow[]> {
    const result = await this.db.query<CallEventRow>(
      `SELECT call_id, event_type, event_time, source, payload
       FROM call_events
       WHERE tenant_id = $1 AND event_time BETWEEN $2 AND $3
       ORDER BY event_time ASC LIMIT 500`,
      [tenantId, from, to],
    );
    return result.rows;
  }

  async findInboundRoutes(routeIds: string[], tenantId: string): Promise<RouteRow[]> {
    if (routeIds.length === 0) return [];
    const result = await this.db.query<RouteRow>(
      `SELECT id, name, status, match_type, match_value, target_type, target_id
       FROM inbound_routes
       WHERE id = ANY($1) AND tenant_id = $2`,
      [routeIds, tenantId],
    );
    return result.rows;
  }

  async findAllActiveInboundRoutes(tenantId: string): Promise<RouteRow[]> {
    const result = await this.db.query<RouteRow>(
      `SELECT id, name, status, match_type, match_value, target_type, target_id
       FROM inbound_routes
       WHERE tenant_id = $1 AND status = 'active'
       ORDER BY name LIMIT 50`,
      [tenantId],
    );
    return result.rows;
  }

  async findGatewayStatus(): Promise<GatewayStatusRow[]> {
    const result = await this.db.query<GatewayStatusRow>(
      `SELECT n.display_name AS gateway_name,
              CASE WHEN s.missing_required_modules = '{}' THEN 'up' ELSE 'degraded' END AS state,
              NULL::int AS ping_time_ms,
              s.queried_at AS updated_at
       FROM freeswitch_node_status_snapshots s
       JOIN freeswitch_nodes n ON n.id = s.node_id
       WHERE n.status = 'active'
       ORDER BY s.queried_at DESC LIMIT 20`,
    );
    return result.rows;
  }

  async findRecentFailedCalls(tenantId: string, limit = 20): Promise<Array<{ call_id: string; event_type: string; source: string | null; event_time: Date }>> {
    const result = await this.db.query<{ call_id: string; event_type: string; source: string | null; event_time: Date }>(
      `SELECT call_id, event_type, source, event_time
       FROM call_events
       WHERE tenant_id = $1
         AND event_type IN ('call.failed', 'call.rejected', 'call.no_answer')
       ORDER BY event_time DESC LIMIT $2`,
      [tenantId, limit],
    );
    return result.rows;
  }
}
