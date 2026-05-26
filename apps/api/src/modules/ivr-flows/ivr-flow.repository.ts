import type { Pool } from 'pg';
import type { FlowVersion, IvrFlow, IvrFlowWithVersions, ValidationOutcome } from './ivr-flow.types.js';

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
      `SELECT id, tenant_id, flow_id, version_number, state, definition, created_by, created_at, validated_at, published_at
       FROM flow_versions WHERE flow_id = $1 ORDER BY version_number DESC`,
      [id],
    );
    return { ...flowR.rows[0], versions: versionsR.rows };
  }

  async findVersionById(versionId: string, flowId: string, tenantId: string): Promise<FlowVersion | null> {
    const r = await this.db.query<FlowVersion>(
      `SELECT fv.id, fv.tenant_id, fv.flow_id, fv.version_number, fv.state, fv.definition, fv.created_by, fv.created_at, fv.validated_at, fv.published_at
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
    definition: Record<string, unknown>;
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
         RETURNING id, tenant_id, flow_id, version_number, state, definition, created_by, created_at, validated_at, published_at`,
        [input.tenant_id, flow.id, JSON.stringify(input.definition), input.created_by ?? null],
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
         RETURNING id, tenant_id, flow_id, version_number, state, definition, created_by, created_at, validated_at, published_at`,
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
       RETURNING id, tenant_id, flow_id, version_number, state, definition, created_by, created_at, validated_at, published_at`,
      [JSON.stringify(definition), versionId, flowId, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async markVersionValidated(versionId: string, flowId: string, tenantId: string): Promise<FlowVersion | null> {
    const r = await this.db.query<FlowVersion>(
      `UPDATE flow_versions SET state = 'validated', validated_at = NOW()
       WHERE id = $1 AND flow_id = $2
         AND tenant_id = (SELECT tenant_id FROM ivr_flows WHERE id = $2 AND tenant_id = $3 LIMIT 1)
       RETURNING id, tenant_id, flow_id, version_number, state, definition, created_by, created_at, validated_at, published_at`,
      [versionId, flowId, tenantId],
    );
    return r.rows[0] ?? null;
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
}
