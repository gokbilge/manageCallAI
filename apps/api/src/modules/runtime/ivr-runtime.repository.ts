import type { Pool } from 'pg';
import type {
  ExtensionTransferReference,
  PromptAssetReference,
} from '../ivr-flows/ivr-flow.types.js';
import type { IvrRuntimeSession, IvrRuntimeSessionStep } from './ivr-runtime.types.js';

interface ActiveFlowVersionRecord {
  tenant_id: string;
  flow_id: string;
  flow_version_id: string;
  graph_json: Record<string, unknown>;
}

interface CallEventRecord {
  id: string;
  call_id: string;
  event_type: string;
  event_time: Date;
  source: string | null;
  payload: Record<string, unknown>;
  ingested_at: Date;
}

export class IvrRuntimeRepository {
  constructor(private readonly db: Pool) {}

  private readonly sessionColumns = `
    id,
    tenant_id,
    flow_id,
    flow_version_id,
    call_id,
    status,
    current_node_id,
    caller_number,
    destination_number,
    last_digits,
    variables_json,
    last_action_json,
    completed_at,
    created_at,
    updated_at
  `;

  async findActiveFlowVersion(flowId: string): Promise<ActiveFlowVersionRecord | null> {
    const result = await this.db.query<ActiveFlowVersionRecord>(
      `SELECT
         f.tenant_id,
         f.id AS flow_id,
         fv.id AS flow_version_id,
         fv.definition AS graph_json
       FROM ivr_flows f
       JOIN flow_versions fv ON fv.id = f.active_version_id
       WHERE f.id = $1
         AND f.status = 'active'
         AND fv.state = 'published'`,
      [flowId],
    );
    return result.rows[0] ?? null;
  }

  async createSession(input: {
    tenant_id: string;
    flow_id: string;
    flow_version_id: string;
    call_id: string;
    caller_number?: string;
    destination_number?: string;
    variables_json: Record<string, string>;
    current_node_id?: string | null;
    last_digits?: string | null;
    last_action_json?: Record<string, unknown> | null;
  }): Promise<IvrRuntimeSession> {
    const result = await this.db.query<IvrRuntimeSession>(
      `INSERT INTO ivr_flow_sessions
         (tenant_id, flow_id, flow_version_id, call_id, status, current_node_id, caller_number, destination_number, last_digits, variables_json, last_action_json)
       VALUES ($1, $2, $3, $4, 'running', $5, $6, $7, $8, $9, $10)
       RETURNING ${this.sessionColumns}`,
      [
        input.tenant_id,
        input.flow_id,
        input.flow_version_id,
        input.call_id,
        input.current_node_id ?? null,
        input.caller_number ?? null,
        input.destination_number ?? null,
        input.last_digits ?? null,
        JSON.stringify(input.variables_json),
        input.last_action_json ? JSON.stringify(input.last_action_json) : null,
      ],
    );
    return result.rows[0]!;
  }

  async findSessionById(id: string): Promise<IvrRuntimeSession | null> {
    const result = await this.db.query<IvrRuntimeSession>(
      `SELECT ${this.sessionColumns}
       FROM ivr_flow_sessions
       WHERE id = $1`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async findSessionByIdForTenant(id: string, tenantId: string): Promise<IvrRuntimeSession | null> {
    const result = await this.db.query<IvrRuntimeSession>(
      `SELECT ${this.sessionColumns}
       FROM ivr_flow_sessions
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async updateSessionState(input: {
    id: string;
    status: IvrRuntimeSession['status'];
    current_node_id: string | null;
    last_digits?: string | null;
    variables_json: Record<string, string>;
    last_action_json: Record<string, unknown> | null;
    completed_at?: Date | null;
  }): Promise<IvrRuntimeSession> {
    const result = await this.db.query<IvrRuntimeSession>(
      `UPDATE ivr_flow_sessions
       SET status = $2,
           current_node_id = $3,
           last_digits = $4,
           variables_json = $5,
           last_action_json = $6,
           completed_at = $7,
           updated_at = NOW()
       WHERE id = $1
       RETURNING ${this.sessionColumns}`,
      [
        input.id,
        input.status,
        input.current_node_id,
        input.last_digits ?? null,
        JSON.stringify(input.variables_json),
        input.last_action_json ? JSON.stringify(input.last_action_json) : null,
        input.completed_at ?? null,
      ],
    );
    return result.rows[0]!;
  }

  async getFlowGraphForSession(sessionId: string): Promise<ActiveFlowVersionRecord | null> {
    const result = await this.db.query<ActiveFlowVersionRecord>(
      `SELECT
         s.tenant_id,
         s.flow_id,
         s.flow_version_id,
         fv.definition AS graph_json
       FROM ivr_flow_sessions s
       JOIN flow_versions fv ON fv.id = s.flow_version_id
       WHERE s.id = $1`,
      [sessionId],
    );
    return result.rows[0] ?? null;
  }

  async listSessionsByTenant(
    tenantId: string,
    status?: IvrRuntimeSession['status'],
  ): Promise<IvrRuntimeSession[]> {
    const params: unknown[] = [tenantId];
    const statusClause = status ? ` AND status = $${params.push(status)}` : '';
    const result = await this.db.query<IvrRuntimeSession>(
      `SELECT ${this.sessionColumns}
       FROM ivr_flow_sessions
       WHERE tenant_id = $1${statusClause}
       ORDER BY created_at DESC
       LIMIT 200`,
      params,
    );
    return result.rows;
  }

  async recordSessionStep(input: {
    tenant_id: string;
    session_id: string;
    phase: IvrRuntimeSessionStep['phase'];
    node_id: string | null;
    outcome: IvrRuntimeSessionStep['outcome'];
    digits?: string | null;
    action_json: Record<string, unknown> | null;
    resulting_node_id: string | null;
    resulting_status: IvrRuntimeSession['status'];
    variables_json: Record<string, string>;
  }): Promise<IvrRuntimeSessionStep> {
    const result = await this.db.query<IvrRuntimeSessionStep>(
      `INSERT INTO ivr_flow_session_steps
         (tenant_id, session_id, step_index, phase, node_id, outcome, digits, action_json, resulting_node_id, resulting_status, variables_json)
       SELECT
         $1,
         $2,
         COALESCE(MAX(step_index), 0) + 1,
         $3,
         $4,
         $5,
         $6,
         $7,
         $8,
         $9,
         $10
       FROM ivr_flow_session_steps
       WHERE session_id = $2
       RETURNING id, tenant_id, session_id, step_index, phase, node_id, outcome, digits, action_json, resulting_node_id, resulting_status, variables_json, created_at`,
      [
        input.tenant_id,
        input.session_id,
        input.phase,
        input.node_id,
        input.outcome,
        input.digits ?? null,
        input.action_json ? JSON.stringify(input.action_json) : null,
        input.resulting_node_id,
        input.resulting_status,
        JSON.stringify(input.variables_json),
      ],
    );
    return result.rows[0]!;
  }

  async listSessionSteps(sessionId: string, tenantId: string): Promise<IvrRuntimeSessionStep[]> {
    const result = await this.db.query<IvrRuntimeSessionStep>(
      `SELECT id, tenant_id, session_id, step_index, phase, node_id, outcome, digits, action_json, resulting_node_id, resulting_status, variables_json, created_at
       FROM ivr_flow_session_steps
       WHERE session_id = $1 AND tenant_id = $2
       ORDER BY step_index ASC`,
      [sessionId, tenantId],
    );
    return result.rows;
  }

  async listCallEventsByCallId(callId: string, tenantId: string): Promise<CallEventRecord[]> {
    const result = await this.db.query<CallEventRecord>(
      `SELECT id, call_id, event_type, event_time, source, payload, ingested_at
       FROM call_events
       WHERE tenant_id = $1 AND call_id = $2
       ORDER BY event_time ASC, ingested_at ASC`,
      [tenantId, callId],
    );
    return result.rows;
  }

  async findActivePromptRefs(tenantId: string, ids: string[]): Promise<Map<string, PromptAssetReference>> {
    if (ids.length === 0) return new Map();
    const result = await this.db.query<PromptAssetReference>(
      `SELECT id, name, storage_uri
       FROM prompt_assets
       WHERE tenant_id = $1 AND id = ANY($2) AND status = 'active'`,
      [tenantId, ids],
    );
    return new Map(result.rows.map((row) => [row.id, row]));
  }

  async findActiveExtensionTargets(tenantId: string, ids: string[]): Promise<Map<string, ExtensionTransferReference>> {
    if (ids.length === 0) return new Map();
    const result = await this.db.query<ExtensionTransferReference>(
      `SELECT e.id, e.extension_number, e.display_name, t.directory_domain
       FROM extensions e
       JOIN tenants t ON t.id = e.tenant_id
       WHERE e.tenant_id = $1 AND e.id = ANY($2) AND e.status = 'active'`,
      [tenantId, ids],
    );
    return new Map(result.rows.map((row) => [row.id, row]));
  }

  async findActiveSchedule(tenantId: string, scheduleId: string): Promise<{
    id: string;
    timezone: string;
    weekly_rules_json: unknown;
    holiday_overrides_json: unknown;
  } | null> {
    const result = await this.db.query<{
      id: string;
      timezone: string;
      weekly_rules_json: unknown;
      holiday_overrides_json: unknown;
    }>(
      `SELECT id, timezone, weekly_rules_json, holiday_overrides_json
       FROM schedules WHERE tenant_id = $1 AND id = $2 AND status = 'active'`,
      [tenantId, scheduleId],
    );
    return result.rows[0] ?? null;
  }
}
