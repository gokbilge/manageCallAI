import type { Pool } from 'pg';
import type { EnterpriseObjectType, EnterpriseVersion } from './enterprise-lifecycle.types.js';

// Table metadata is derived from a fixed map — not user input.
const TABLE_META: Record<EnterpriseObjectType, { objectTable: string; versionTable: string; fkColumn: string }> = {
  trunk_group:     { objectTable: 'trunk_groups',     versionTable: 'trunk_group_versions',     fkColumn: 'trunk_group_id' },
  numbering_plan:  { objectTable: 'numbering_plans',  versionTable: 'numbering_plan_versions',  fkColumn: 'numbering_plan_id' },
  calling_policy:  { objectTable: 'calling_policies', versionTable: 'calling_policy_versions',  fkColumn: 'calling_policy_id' },
  site:            { objectTable: 'sites',            versionTable: 'site_versions',            fkColumn: 'site_id' },
  schedule:        { objectTable: 'schedules',        versionTable: 'schedule_versions',        fkColumn: 'schedule_id' },
  line_appearance: { objectTable: 'line_appearances', versionTable: 'line_appearance_versions', fkColumn: 'line_appearance_id' },
};

function versionRow(row: Record<string, unknown>, fkColumn: string): EnterpriseVersion {
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    object_id: row[fkColumn] as string,
    version_number: row.version_number as number,
    state: row.state as EnterpriseVersion['state'],
    definition: (row.definition ?? {}) as Record<string, unknown>,
    created_by: (row.created_by as string | null) ?? null,
    created_at: row.created_at as Date,
    validated_at: (row.validated_at as Date | null) ?? null,
    simulated_at: (row.simulated_at as Date | null) ?? null,
    published_at: (row.published_at as Date | null) ?? null,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
  };
}

export class EnterpriseLifecycleRepository {
  constructor(private readonly db: Pool) {}

  async createVersion(input: {
    objectType: EnterpriseObjectType;
    objectId: string;
    tenantId: string;
    versionNumber: number;
    definition: Record<string, unknown>;
    createdBy?: string;
    metadata?: Record<string, unknown>;
  }): Promise<EnterpriseVersion> {
    const { versionTable, fkColumn } = TABLE_META[input.objectType];
    const r = await this.db.query(
      `INSERT INTO ${versionTable} (tenant_id, ${fkColumn}, version_number, state, definition, created_by, metadata)
       VALUES ($1, $2, $3, 'draft', $4, $5, $6)
       RETURNING *`,
      [input.tenantId, input.objectId, input.versionNumber, JSON.stringify(input.definition),
       input.createdBy ?? null, JSON.stringify(input.metadata ?? {})],
    );
    return versionRow(r.rows[0] as Record<string, unknown>, fkColumn);
  }

  async findVersionById(objectType: EnterpriseObjectType, versionId: string, objectId: string, tenantId: string): Promise<EnterpriseVersion | null> {
    const { versionTable, fkColumn } = TABLE_META[objectType];
    const r = await this.db.query(
      `SELECT v.* FROM ${versionTable} v
       WHERE v.id = $1 AND v.${fkColumn} = $2 AND v.tenant_id = $3`,
      [versionId, objectId, tenantId],
    );
    if (!r.rows[0]) return null;
    return versionRow(r.rows[0] as Record<string, unknown>, fkColumn);
  }

  async findVersionsByObject(objectType: EnterpriseObjectType, objectId: string, tenantId: string): Promise<EnterpriseVersion[]> {
    const { versionTable, fkColumn } = TABLE_META[objectType];
    const r = await this.db.query(
      `SELECT * FROM ${versionTable} WHERE ${fkColumn} = $1 AND tenant_id = $2 ORDER BY version_number DESC`,
      [objectId, tenantId],
    );
    return r.rows.map((row: Record<string, unknown>) => versionRow(row, fkColumn));
  }

  async nextVersionNumber(objectType: EnterpriseObjectType, objectId: string): Promise<number> {
    const { versionTable, fkColumn } = TABLE_META[objectType];
    const r = await this.db.query(
      `SELECT COALESCE(MAX(version_number), 0) + 1 AS next FROM ${versionTable} WHERE ${fkColumn} = $1`,
      [objectId],
    );
    return (r.rows[0] as { next: number }).next;
  }

  async markVersionValidated(objectType: EnterpriseObjectType, versionId: string, objectId: string, tenantId: string): Promise<EnterpriseVersion | null> {
    const { versionTable, objectTable, fkColumn } = TABLE_META[objectType];
    const r = await this.db.query(
      `UPDATE ${versionTable} SET state = 'validated', validated_at = NOW()
       WHERE id = $1 AND ${fkColumn} = $2 AND tenant_id = $3 AND state IN ('draft','validated')
       RETURNING *`,
      [versionId, objectId, tenantId],
    );
    if (!r.rows[0]) return null;
    // Update draft_version_id on the parent object
    await this.db.query(
      `UPDATE ${objectTable} SET draft_version_id = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`,
      [versionId, objectId, tenantId],
    );
    return versionRow(r.rows[0] as Record<string, unknown>, fkColumn);
  }

  async markVersionSimulated(objectType: EnterpriseObjectType, versionId: string, objectId: string, tenantId: string): Promise<EnterpriseVersion | null> {
    const { versionTable, fkColumn } = TABLE_META[objectType];
    const r = await this.db.query(
      `UPDATE ${versionTable} SET state = 'simulated', simulated_at = NOW()
       WHERE id = $1 AND ${fkColumn} = $2 AND tenant_id = $3 AND state IN ('draft','validated','simulated')
       RETURNING *`,
      [versionId, objectId, tenantId],
    );
    if (!r.rows[0]) return null;
    return versionRow(r.rows[0] as Record<string, unknown>, fkColumn);
  }

  async publish(input: {
    objectType: EnterpriseObjectType;
    objectId: string;
    versionId: string;
    tenantId: string;
    triggeredById: string;
    triggeredByType: string;
    approvalRequestId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<EnterpriseVersion> {
    const { versionTable, objectTable, fkColumn } = TABLE_META[input.objectType];
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Supersede current published version if any
      await client.query(
        `UPDATE ${versionTable} SET state = 'superseded'
         WHERE ${fkColumn} = $1 AND tenant_id = $2 AND state = 'published'`,
        [input.objectId, input.tenantId],
      );

      // Publish target version
      const r = await client.query(
        `UPDATE ${versionTable} SET state = 'published', published_at = NOW()
         WHERE id = $1 AND ${fkColumn} = $2 AND tenant_id = $3
         RETURNING *`,
        [input.versionId, input.objectId, input.tenantId],
      );
      const version = versionRow(r.rows[0] as Record<string, unknown>, fkColumn);

      // Update active_version_id on parent object
      await client.query(
        `UPDATE ${objectTable} SET active_version_id = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`,
        [input.versionId, input.objectId, input.tenantId],
      );

      // Record publish
      await client.query(
        `INSERT INTO publish_records (tenant_id, object_type, object_id, version_id, action_type, triggered_by_type, triggered_by_id, approval_request_id, result, metadata)
         VALUES ($1, $2, $3, $4, 'publish', $5, $6, $7, 'success', $8)`,
        [input.tenantId, input.objectType, input.objectId, input.versionId,
         input.triggeredByType, input.triggeredById,
         input.approvalRequestId ?? null, JSON.stringify(input.metadata ?? {})],
      );

      // Audit event
      await client.query(
        `INSERT INTO audit_events (tenant_id, actor_type, actor_id, action, object_type, object_id, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [input.tenantId, input.triggeredByType, input.triggeredById,
         `${input.objectType}.published`, input.objectType, input.objectId,
         JSON.stringify(input.metadata ?? {})],
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

  async rollback(input: {
    objectType: EnterpriseObjectType;
    objectId: string;
    tenantId: string;
    triggeredById: string;
    triggeredByType: string;
    approvalRequestId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<EnterpriseVersion | null> {
    const { versionTable, objectTable, fkColumn } = TABLE_META[input.objectType];
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      // Find most recent superseded version to restore
      const targetR = await client.query(
        `SELECT * FROM ${versionTable}
         WHERE ${fkColumn} = $1 AND tenant_id = $2 AND state = 'superseded'
         ORDER BY version_number DESC LIMIT 1`,
        [input.objectId, input.tenantId],
      );
      if (!targetR.rows[0]) {
        await client.query('ROLLBACK');
        return null;
      }
      const targetVersion = versionRow(targetR.rows[0] as Record<string, unknown>, fkColumn);

      // Mark current published as rolled_back
      await client.query(
        `UPDATE ${versionTable} SET state = 'rolled_back'
         WHERE ${fkColumn} = $1 AND tenant_id = $2 AND state = 'published'`,
        [input.objectId, input.tenantId],
      );

      // Restore superseded version to published
      const r = await client.query(
        `UPDATE ${versionTable} SET state = 'published', published_at = NOW()
         WHERE id = $1 AND ${fkColumn} = $2 AND tenant_id = $3
         RETURNING *`,
        [targetVersion.id, input.objectId, input.tenantId],
      );
      const restoredVersion = versionRow(r.rows[0] as Record<string, unknown>, fkColumn);

      // Update active_version_id
      await client.query(
        `UPDATE ${objectTable} SET active_version_id = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`,
        [targetVersion.id, input.objectId, input.tenantId],
      );

      // Record rollback
      await client.query(
        `INSERT INTO publish_records (tenant_id, object_type, object_id, version_id, action_type, triggered_by_type, triggered_by_id, approval_request_id, result, metadata)
         VALUES ($1, $2, $3, $4, 'rollback', $5, $6, $7, 'success', $8)`,
        [input.tenantId, input.objectType, input.objectId, targetVersion.id,
         input.triggeredByType, input.triggeredById,
         input.approvalRequestId ?? null, JSON.stringify(input.metadata ?? {})],
      );

      // Audit event
      await client.query(
        `INSERT INTO audit_events (tenant_id, actor_type, actor_id, action, object_type, object_id, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [input.tenantId, input.triggeredByType, input.triggeredById,
         `${input.objectType}.rolled_back`, input.objectType, input.objectId,
         JSON.stringify(input.metadata ?? {})],
      );

      await client.query('COMMIT');
      return restoredVersion;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async createApprovalRequest(input: {
    tenantId: string;
    objectType: EnterpriseObjectType;
    objectId: string;
    versionId: string;
    requestedBy: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ id: string }> {
    const r = await this.db.query(
      `INSERT INTO approval_requests (tenant_id, object_type, object_id, version_id, requested_by, status, metadata)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6)
       RETURNING id`,
      [input.tenantId, input.objectType, input.objectId, input.versionId,
       input.requestedBy, JSON.stringify(input.metadata ?? {})],
    );
    return { id: (r.rows[0] as { id: string }).id };
  }

  async storePendingPublishRecord(input: {
    tenantId: string;
    objectType: EnterpriseObjectType;
    objectId: string;
    versionId: string;
    triggeredById: string;
    triggeredByType: string;
    approvalRequestId: string;
    actionType: 'publish' | 'rollback';
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO publish_records (tenant_id, object_type, object_id, version_id, action_type, triggered_by_type, triggered_by_id, approval_request_id, result, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending_approval', $9)`,
      [input.tenantId, input.objectType, input.objectId, input.versionId,
       input.actionType, input.triggeredByType, input.triggeredById,
       input.approvalRequestId, JSON.stringify(input.metadata ?? {})],
    );
  }

  async storeValidationResult(input: {
    tenantId: string;
    objectType: EnterpriseObjectType;
    objectId: string;
    versionId: string;
    outcome: { status: string; errors: unknown[]; warnings: unknown[] };
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO validation_results (tenant_id, object_type, object_id, version_id, validator_version, status, errors, warnings)
       VALUES ($1, $2, $3, $4, '1', $5, $6, $7)`,
      [input.tenantId, input.objectType, input.objectId, input.versionId,
       input.outcome.status, JSON.stringify(input.outcome.errors), JSON.stringify(input.outcome.warnings)],
    );
  }

  async storeSimulationResult(input: {
    tenantId: string;
    objectType: EnterpriseObjectType;
    objectId: string;
    versionId: string;
    scenario: Record<string, unknown>;
    outcome: Record<string, unknown>;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO simulation_results (tenant_id, object_type, object_id, version_id, scenario, status, result_payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [input.tenantId, input.objectType, input.objectId, input.versionId,
       JSON.stringify(input.scenario), (input.outcome.status as string) ?? 'passed', JSON.stringify(input.outcome)],
    );
  }

  async getActivePublishPolicy(tenantId: string): Promise<{ require_approval: boolean } | null> {
    const r = await this.db.query<{ require_approval: boolean }>(
      `SELECT require_approval FROM publish_policies WHERE tenant_id = $1 AND is_active = true LIMIT 1`,
      [tenantId],
    );
    return r.rows[0] ?? null;
  }
}
