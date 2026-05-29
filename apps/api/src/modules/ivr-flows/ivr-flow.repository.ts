import type { Pool } from 'pg';
import type {
  ApprovalRequestRecord,
  ExtensionTransferReference,
  FlowAuditHistoryEntry,
  FlowHistory,
  FlowPublishHistoryEntry,
  FlowSimulationHistoryEntry,
  FlowValidationHistoryEntry,
  FlowVersion,
  IvrFlow,
  IvrFlowWithVersions,
  PromptAssetReference,
  QueueTransferReference,
  SimulationOutcome,
  SimulationScenario,
  ValidationOutcome,
  VoicemailBoxReference,
} from './ivr-flow.types.js';

// Naming convention: the DB column is `definition`; the external API field is
// `graph_json`. Every query aliases `definition AS graph_json` so callers
// never see the internal column name.
export class IvrFlowRepository {
  constructor(private readonly db: Pool) {}

  async findAllByTenant(tenantId: string): Promise<IvrFlow[]> {
    const r = await this.db.query<IvrFlow>(
      `SELECT id, tenant_id, name, description, status, draft_version_id, active_version_id, created_at, updated_at
       FROM ivr_flows WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return r.rows;
  }

  async findById(id: string, tenantId: string): Promise<IvrFlowWithVersions | null> {
    const flowR = await this.db.query<IvrFlow>(
      `SELECT id, tenant_id, name, description, status, draft_version_id, active_version_id, created_at, updated_at
       FROM ivr_flows WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (!flowR.rows[0]) return null;

    const versionsR = await this.db.query<FlowVersion>(
      `SELECT id, tenant_id, flow_id, version_number, state, definition AS graph_json, created_by, created_at, validated_at, simulated_at, published_at
       FROM flow_versions WHERE flow_id = $1 ORDER BY version_number DESC`,
      [id],
    );
    return { ...flowR.rows[0], versions: versionsR.rows };
  }

  async findVersionById(versionId: string, flowId: string, tenantId: string): Promise<FlowVersion | null> {
    const r = await this.db.query<FlowVersion>(
      `SELECT fv.id, fv.tenant_id, fv.flow_id, fv.version_number, fv.state, fv.definition AS graph_json, fv.created_by, fv.created_at, fv.validated_at, fv.simulated_at, fv.published_at
       FROM flow_versions fv
       JOIN ivr_flows f ON f.id = fv.flow_id
       WHERE fv.id = $1 AND fv.flow_id = $2 AND f.tenant_id = $3`,
      [versionId, flowId, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async create(input: {
    tenant_id: string;
    name: string;
    description?: string;
    graph_json: Record<string, unknown>;
    created_by?: string;
  }): Promise<IvrFlowWithVersions> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      const flowR = await client.query<IvrFlow>(
        `INSERT INTO ivr_flows (tenant_id, name, description, status)
         VALUES ($1, $2, $3, 'draft')
         RETURNING id, tenant_id, name, description, status, draft_version_id, active_version_id, created_at, updated_at`,
        [input.tenant_id, input.name, input.description ?? null],
      );
      const flow = flowR.rows[0]!;

      const versionR = await client.query<FlowVersion>(
        `INSERT INTO flow_versions (tenant_id, flow_id, version_number, state, definition, created_by)
         VALUES ($1, $2, 1, 'draft', $3, $4)
         RETURNING id, tenant_id, flow_id, version_number, state, definition AS graph_json, created_by, created_at, validated_at, simulated_at, published_at`,
        [input.tenant_id, flow.id, JSON.stringify(input.graph_json), input.created_by ?? null],
      );
      const version = versionR.rows[0]!;

      await client.query(
        `UPDATE ivr_flows SET draft_version_id = $1, updated_at = NOW() WHERE id = $2`,
        [version.id, flow.id],
      );

      await client.query('COMMIT');
      return { ...flow, draft_version_id: version.id, versions: [version] };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async update(id: string, tenantId: string, input: { name?: string; description?: string | null }): Promise<IvrFlow | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (input.name !== undefined) { fields.push(`name = $${idx++}`); values.push(input.name); }
    if ('description' in input) { fields.push(`description = $${idx++}`); values.push(input.description ?? null); }
    if (fields.length === 0) {
      const r = await this.db.query<IvrFlow>(
        `SELECT id, tenant_id, name, description, status, draft_version_id, active_version_id, created_at, updated_at FROM ivr_flows WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId],
      );
      return r.rows[0] ?? null;
    }
    fields.push(`updated_at = NOW()`);
    values.push(id, tenantId);
    const r = await this.db.query<IvrFlow>(
      `UPDATE ivr_flows SET ${fields.join(', ')} WHERE id = $${idx} AND tenant_id = $${idx + 1}
       RETURNING id, tenant_id, name, description, status, draft_version_id, active_version_id, created_at, updated_at`,
      values,
    );
    return r.rows[0] ?? null;
  }

  async createVersion(input: {
    tenant_id: string;
    flow_id: string;
    version_number: number;
    definition: Record<string, unknown>;
    created_by?: string;
  }): Promise<FlowVersion> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const versionR = await client.query<FlowVersion>(
        `INSERT INTO flow_versions (tenant_id, flow_id, version_number, state, definition, created_by)
         VALUES ($1, $2, $3, 'draft', $4, $5)
         RETURNING id, tenant_id, flow_id, version_number, state, definition AS graph_json, created_by, created_at, validated_at, simulated_at, published_at`,
        [input.tenant_id, input.flow_id, input.version_number, JSON.stringify(input.definition), input.created_by ?? null],
      );
      const version = versionR.rows[0]!;
      await client.query(
        `UPDATE ivr_flows SET draft_version_id = $1, updated_at = NOW() WHERE id = $2`,
        [version.id, input.flow_id],
      );
      await client.query('COMMIT');
      return version;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async updateVersionDefinition(versionId: string, flowId: string, tenantId: string, definition: Record<string, unknown>): Promise<FlowVersion | null> {
    const r = await this.db.query<FlowVersion>(
      `UPDATE flow_versions SET definition = $1
       WHERE id = $2 AND flow_id = $3 AND state = 'draft'
         AND tenant_id = (SELECT tenant_id FROM ivr_flows WHERE id = $3 AND tenant_id = $4 LIMIT 1)
       RETURNING id, tenant_id, flow_id, version_number, state, definition AS graph_json, created_by, created_at, validated_at, simulated_at, published_at`,
      [JSON.stringify(definition), versionId, flowId, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async markVersionValidated(versionId: string, flowId: string, tenantId: string): Promise<FlowVersion | null> {
    const r = await this.db.query<FlowVersion>(
      `UPDATE flow_versions SET state = 'validated', validated_at = NOW()
       WHERE id = $1 AND flow_id = $2
         AND tenant_id = (SELECT tenant_id FROM ivr_flows WHERE id = $2 AND tenant_id = $3 LIMIT 1)
       RETURNING id, tenant_id, flow_id, version_number, state, definition AS graph_json, created_by, created_at, validated_at, simulated_at, published_at`,
      [versionId, flowId, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async markVersionSimulated(versionId: string, flowId: string, tenantId: string): Promise<FlowVersion | null> {
    const r = await this.db.query<FlowVersion>(
      `UPDATE flow_versions
       SET state = CASE WHEN state = 'draft' THEN 'simulated' ELSE state END,
           simulated_at = NOW()
       WHERE id = $1 AND flow_id = $2
         AND tenant_id = (SELECT tenant_id FROM ivr_flows WHERE id = $2 AND tenant_id = $3 LIMIT 1)
       RETURNING id, tenant_id, flow_id, version_number, state, definition AS graph_json, created_by, created_at, validated_at, simulated_at, published_at`,
      [versionId, flowId, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async findVersionsByFlowId(flowId: string, tenantId: string): Promise<FlowVersion[]> {
    const r = await this.db.query<FlowVersion>(
      `SELECT fv.id, fv.tenant_id, fv.flow_id, fv.version_number, fv.state, fv.definition AS graph_json,
              fv.created_by, fv.created_at, fv.validated_at, fv.simulated_at, fv.published_at
       FROM flow_versions fv
       JOIN ivr_flows f ON f.id = fv.flow_id
       WHERE fv.flow_id = $1 AND f.tenant_id = $2
       ORDER BY fv.version_number DESC`,
      [flowId, tenantId],
    );
    return r.rows;
  }

  async getHistory(flowId: string, tenantId: string): Promise<FlowHistory> {
    const [validations, simulations, publishes, audits] = await Promise.all([
      this.db.query<FlowValidationHistoryEntry>(
        `SELECT id, version_id, validator_version, status, errors, warnings, created_at
         FROM validation_results
         WHERE tenant_id = $1 AND object_type = 'ivr_flow' AND object_id = $2
         ORDER BY created_at DESC
         LIMIT 50`,
        [tenantId, flowId],
      ),
      this.db.query<FlowSimulationHistoryEntry>(
        `SELECT id, version_id, scenario, status, result_payload, created_at
         FROM simulation_results
         WHERE tenant_id = $1 AND object_type = 'ivr_flow' AND object_id = $2
         ORDER BY created_at DESC
         LIMIT 50`,
        [tenantId, flowId],
      ),
      this.db.query<FlowPublishHistoryEntry>(
        `SELECT
           pr.id,
           pr.version_id,
           pr.action_type,
           pr.triggered_by_type,
           pr.triggered_by_id,
           pr.approval_request_id,
           ar.status AS approval_status,
           ar.decision_at,
           pr.result,
           pr.created_at
         FROM publish_records pr
         LEFT JOIN approval_requests ar ON ar.id = pr.approval_request_id
         WHERE pr.tenant_id = $1 AND pr.object_type = 'ivr_flow' AND pr.object_id = $2
         ORDER BY pr.created_at DESC
         LIMIT 50`,
        [tenantId, flowId],
      ),
      this.db.query<FlowAuditHistoryEntry>(
        `SELECT id, actor_type, actor_id, action, metadata, created_at
         FROM audit_events
         WHERE tenant_id = $1 AND object_type = 'ivr_flow' AND object_id = $2
         ORDER BY created_at DESC
         LIMIT 50`,
        [tenantId, flowId],
      ),
    ]);

    return {
      validations: validations.rows,
      simulations: simulations.rows,
      publishes: publishes.rows,
      audits: audits.rows,
    };
  }

  async storeValidationResult(input: {
    tenant_id: string;
    flow_id: string;
    version_id: string;
    outcome: ValidationOutcome;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO validation_results (tenant_id, object_type, object_id, version_id, validator_version, status, errors, warnings)
       VALUES ($1, 'ivr_flow', $2, $3, '1.0', $4, $5, $6)`,
      [
        input.tenant_id,
        input.flow_id,
        input.version_id,
        input.outcome.status,
        JSON.stringify(input.outcome.errors),
        JSON.stringify(input.outcome.warnings),
      ],
    );
  }

  async storeSimulationResult(input: {
    tenant_id: string;
    flow_id: string;
    version_id: string;
    scenario: SimulationScenario;
    outcome: SimulationOutcome;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO simulation_results (tenant_id, object_type, object_id, version_id, scenario, status, result_payload)
       VALUES ($1, 'ivr_flow', $2, $3, $4, $5, $6)`,
      [
        input.tenant_id,
        input.flow_id,
        input.version_id,
        JSON.stringify(input.scenario),
        input.outcome.status,
        JSON.stringify(input.outcome),
      ],
    );
  }

  async getActivePublishPolicy(tenantId: string): Promise<{ require_approval: boolean } | null> {
    const r = await this.db.query<{ rules: { require_approval?: boolean } }>(
      `SELECT rules
       FROM policies
       WHERE tenant_id = $1 AND policy_type = 'ivr_publish_control' AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
      [tenantId],
    );
    if (!r.rows[0]) return null;
    return { require_approval: r.rows[0].rules?.require_approval === true };
  }

  async createApprovalRequest(input: {
    tenant_id: string;
    flow_id: string;
    version_id: string;
    requested_by: string;
  }): Promise<ApprovalRequestRecord> {
    const r = await this.db.query<ApprovalRequestRecord>(
      `INSERT INTO approval_requests (tenant_id, object_type, object_id, version_id, requested_by, status)
       VALUES ($1, 'ivr_flow', $2, $3, $4, 'pending')
       RETURNING id, tenant_id, object_type, object_id, version_id, requested_by, status, created_at`,
      [input.tenant_id, input.flow_id, input.version_id, input.requested_by],
    );
    return r.rows[0]!;
  }

  async storePendingPublishRecord(input: {
    tenant_id: string;
    flow_id: string;
    version_id: string;
    triggered_by_id: string;
    approval_request_id: string;
    action_type: 'publish' | 'rollback';
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO publish_records (tenant_id, object_type, object_id, version_id, action_type, triggered_by_type, triggered_by_id, approval_request_id, result)
       VALUES ($1, 'ivr_flow', $2, $3, $4, 'user', $5, $6, 'pending_approval')`,
      [
        input.tenant_id,
        input.flow_id,
        input.version_id,
        input.action_type,
        input.triggered_by_id,
        input.approval_request_id,
      ],
    );
  }

  async publish(input: {
    tenant_id: string;
    flow_id: string;
    version_id: string;
    triggered_by_id: string;
  }): Promise<IvrFlow> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Supersede the current active version (if any)
      await client.query(
        `UPDATE flow_versions SET state = 'superseded'
         WHERE flow_id = $1 AND state = 'published'`,
        [input.flow_id],
      );

      // Mark this version as published
      await client.query(
        `UPDATE flow_versions SET state = 'published', published_at = NOW()
         WHERE id = $1`,
        [input.version_id],
      );

      // Point flow at new active version
      const flowR = await client.query<IvrFlow>(
        `UPDATE ivr_flows
         SET active_version_id = $1, status = 'active', updated_at = NOW()
         WHERE id = $2
         RETURNING id, tenant_id, name, description, status, draft_version_id, active_version_id, created_at, updated_at`,
        [input.version_id, input.flow_id],
      );

      // Publish record
      await client.query(
        `INSERT INTO publish_records (tenant_id, object_type, object_id, version_id, action_type, triggered_by_type, triggered_by_id, result)
         VALUES ($1, 'ivr_flow', $2, $3, 'publish', 'user', $4, 'success')`,
        [input.tenant_id, input.flow_id, input.version_id, input.triggered_by_id],
      );

      // Audit event
      await client.query(
        `INSERT INTO audit_events (tenant_id, actor_type, actor_id, action, object_type, object_id)
         VALUES ($1, 'user', $2, 'publish', 'ivr_flow', $3)`,
        [input.tenant_id, input.triggered_by_id, input.flow_id],
      );

      await client.query('COMMIT');
      return flowR.rows[0]!;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async rollback(input: {
    tenant_id: string;
    flow_id: string;
    triggered_by_id: string;
  }): Promise<{ flow: IvrFlow; target_version_id: string } | null> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Find the most recent superseded version
      const targetR = await client.query<FlowVersion>(
        `SELECT id, version_number FROM flow_versions
         WHERE flow_id = $1 AND state = 'superseded'
         ORDER BY version_number DESC LIMIT 1`,
        [input.flow_id],
      );
      const target = targetR.rows[0];
      if (!target) { await client.query('ROLLBACK'); return null; }

      // Supersede current active
      await client.query(
        `UPDATE flow_versions SET state = 'superseded' WHERE flow_id = $1 AND state = 'published'`,
        [input.flow_id],
      );

      // Re-activate target version
      await client.query(
        `UPDATE flow_versions SET state = 'published', published_at = NOW() WHERE id = $1`,
        [target.id],
      );

      // Update flow pointer
      const flowR = await client.query<IvrFlow>(
        `UPDATE ivr_flows SET active_version_id = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, tenant_id, name, description, status, draft_version_id, active_version_id, created_at, updated_at`,
        [target.id, input.flow_id],
      );

      // Publish record + audit
      await client.query(
        `INSERT INTO publish_records (tenant_id, object_type, object_id, version_id, action_type, triggered_by_type, triggered_by_id, result)
         VALUES ($1, 'ivr_flow', $2, $3, 'rollback', 'user', $4, 'success')`,
        [input.tenant_id, input.flow_id, target.id, input.triggered_by_id],
      );
      await client.query(
        `INSERT INTO audit_events (tenant_id, actor_type, actor_id, action, object_type, object_id)
         VALUES ($1, 'user', $2, 'rollback', 'ivr_flow', $3)`,
        [input.tenant_id, input.triggered_by_id, input.flow_id],
      );

      await client.query('COMMIT');
      return { flow: flowR.rows[0]!, target_version_id: target.id };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async nextVersionNumber(flowId: string): Promise<number> {
    const r = await this.db.query<{ max: number | null }>(
      `SELECT MAX(version_number) AS max FROM flow_versions WHERE flow_id = $1`,
      [flowId],
    );
    return (r.rows[0]?.max ?? 0) + 1;
  }

  async findActiveExtensionIds(tenantId: string, ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const r = await this.db.query<{ id: string }>(
      `SELECT id FROM extensions WHERE tenant_id = $1 AND id = ANY($2) AND status = 'active'`,
      [tenantId, ids],
    );
    return new Set(r.rows.map((row) => row.id));
  }

  async findActivePromptRefs(tenantId: string, ids: string[]): Promise<Map<string, PromptAssetReference>> {
    if (ids.length === 0) return new Map();
    const r = await this.db.query<PromptAssetReference>(
      `SELECT id, name, storage_uri
       FROM prompt_assets
       WHERE tenant_id = $1 AND id = ANY($2) AND status = 'active'`,
      [tenantId, ids],
    );
    return new Map(r.rows.map((row) => [row.id, row]));
  }

  async findActiveExtensionTargets(tenantId: string, ids: string[]): Promise<Map<string, ExtensionTransferReference>> {
    if (ids.length === 0) return new Map();
    const r = await this.db.query<ExtensionTransferReference>(
      `SELECT e.id, e.extension_number, e.display_name, t.directory_domain
       FROM extensions e
       JOIN tenants t ON t.id = e.tenant_id
       WHERE e.tenant_id = $1 AND e.id = ANY($2) AND e.status = 'active'`,
      [tenantId, ids],
    );
    return new Map(r.rows.map((row) => [row.id, row]));
  }

  async findActiveScheduleRefs(tenantId: string, ids: string[]): Promise<Map<string, { id: string; timezone: string; weekly_rules_json: unknown; holiday_overrides_json: unknown }>> {
    if (ids.length === 0) return new Map();
    const r = await this.db.query<{ id: string; timezone: string; weekly_rules_json: unknown; holiday_overrides_json: unknown }>(
      `SELECT id, timezone, weekly_rules_json, holiday_overrides_json
       FROM schedules WHERE tenant_id = $1 AND id = ANY($2) AND status = 'active'`,
      [tenantId, ids],
    );
    return new Map(r.rows.map((row) => [row.id, row]));
  }

  async findActiveQueueRefs(tenantId: string, ids: string[]): Promise<Map<string, QueueTransferReference>> {
    if (ids.length === 0) return new Map();
    const queuesR = await this.db.query<{
      id: string;
      name: string;
      strategy: 'simultaneous' | 'sequential';
      ring_timeout_seconds: number;
    }>(
      `SELECT id, name, strategy, ring_timeout_seconds
       FROM queues
       WHERE tenant_id = $1 AND id = ANY($2) AND status = 'active'`,
      [tenantId, ids],
    );
    if (queuesR.rows.length === 0) return new Map();

    const membersR = await this.db.query<{
      queue_id: string;
      extension_number: string;
      directory_domain: string | null;
      position: number;
    }>(
      `SELECT qm.queue_id, e.extension_number, t.directory_domain, qm.position
       FROM queue_members qm
       JOIN extensions e ON e.id = qm.extension_id
       JOIN tenants t ON t.id = qm.tenant_id
       WHERE qm.tenant_id = $1 AND qm.queue_id = ANY($2) AND e.status = 'active'
       ORDER BY qm.position ASC, e.extension_number ASC`,
      [tenantId, ids],
    );

    const membersByQueue = new Map<string, QueueTransferReference['members']>();
    for (const row of membersR.rows) {
      const members = membersByQueue.get(row.queue_id) ?? [];
      members.push({
        extension_number: row.extension_number,
        directory_domain: row.directory_domain,
        position: row.position,
      });
      membersByQueue.set(row.queue_id, members);
    }

    return new Map(queuesR.rows.map((row) => [row.id, {
      id: row.id,
      name: row.name,
      strategy: row.strategy,
      ring_timeout_seconds: row.ring_timeout_seconds,
      members: membersByQueue.get(row.id) ?? [],
    }]));
  }

  async findActiveVoicemailBoxRefs(tenantId: string, ids: string[]): Promise<Map<string, VoicemailBoxReference>> {
    if (ids.length === 0) return new Map();
    const r = await this.db.query<VoicemailBoxReference>(
      `SELECT vb.id, vb.name, vb.mailbox_number, t.directory_domain, pa.storage_uri AS greeting_prompt_uri
       FROM voicemail_boxes vb
       JOIN tenants t ON t.id = vb.tenant_id
       LEFT JOIN prompt_assets pa ON pa.id = vb.greeting_prompt_id
       WHERE vb.tenant_id = $1 AND vb.id = ANY($2) AND vb.status = 'active'`,
      [tenantId, ids],
    );
    return new Map(r.rows.map((row) => [row.id, row]));
  }
}
