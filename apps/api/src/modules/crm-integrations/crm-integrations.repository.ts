import type { Pool } from 'pg';
import type {
  CreateCrmIntegrationInput,
  CrmIntegration,
  CrmLookupLog,
  CrmLookupOutcome,
  UpdateCrmIntegrationInput,
} from './crm-integrations.types.js';

const CRM_COLUMNS = `id, tenant_id, name, provider, lookup_url_template,
  payload_template, status, created_at, updated_at`;

export class CrmIntegrationsRepository {
  constructor(private readonly db: Pool) {}

  async findAllByTenant(tenantId: string): Promise<CrmIntegration[]> {
    const r = await this.db.query<CrmIntegration>(
      `SELECT ${CRM_COLUMNS} FROM crm_integrations WHERE tenant_id = $1 ORDER BY name`,
      [tenantId],
    );
    return r.rows;
  }

  async findById(id: string, tenantId: string): Promise<CrmIntegration | null> {
    const r = await this.db.query<CrmIntegration>(
      `SELECT ${CRM_COLUMNS} FROM crm_integrations WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async findActiveByTenant(tenantId: string): Promise<CrmIntegration[]> {
    const r = await this.db.query<CrmIntegration>(
      `SELECT ${CRM_COLUMNS} FROM crm_integrations WHERE tenant_id = $1 AND status = 'active' ORDER BY name`,
      [tenantId],
    );
    return r.rows;
  }

  async create(input: CreateCrmIntegrationInput): Promise<CrmIntegration> {
    const r = await this.db.query<CrmIntegration>(
      `INSERT INTO crm_integrations (tenant_id, name, provider, lookup_url_template, payload_template)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${CRM_COLUMNS}`,
      [
        input.tenant_id,
        input.name,
        input.provider,
        input.lookup_url_template,
        JSON.stringify(input.payload_template ?? {}),
      ],
    );
    return r.rows[0]!;
  }

  async update(id: string, tenantId: string, input: UpdateCrmIntegrationInput): Promise<CrmIntegration | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.name !== undefined) { fields.push(`name = $${idx++}`); values.push(input.name); }
    if (input.lookup_url_template !== undefined) { fields.push(`lookup_url_template = $${idx++}`); values.push(input.lookup_url_template); }
    if (input.payload_template !== undefined) { fields.push(`payload_template = $${idx++}`); values.push(JSON.stringify(input.payload_template)); }
    if (input.status !== undefined) { fields.push(`status = $${idx++}`); values.push(input.status); }

    if (fields.length === 0) return this.findById(id, tenantId);

    fields.push('updated_at = NOW()');
    values.push(id, tenantId);
    const r = await this.db.query<CrmIntegration>(
      `UPDATE crm_integrations SET ${fields.join(', ')}
       WHERE id = $${idx} AND tenant_id = $${idx + 1}
       RETURNING ${CRM_COLUMNS}`,
      values,
    );
    return r.rows[0] ?? null;
  }

  async logLookup(
    tenantId: string,
    crmIntegrationId: string,
    callUuid: string,
    callerId: string,
    outcome: CrmLookupOutcome,
    responseSummary: string | null,
    errorDetail: string | null,
  ): Promise<CrmLookupLog> {
    const r = await this.db.query<CrmLookupLog>(
      `INSERT INTO crm_lookup_log
         (tenant_id, crm_integration_id, call_uuid, caller_id, outcome, response_summary, error_detail)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, tenant_id, crm_integration_id, call_uuid, caller_id, outcome, response_summary, error_detail, looked_up_at`,
      [tenantId, crmIntegrationId, callUuid, callerId, outcome, responseSummary, errorDetail],
    );
    return r.rows[0]!;
  }

  async findLookupLog(crmIntegrationId: string, tenantId: string, limit = 50): Promise<CrmLookupLog[]> {
    const r = await this.db.query<CrmLookupLog>(
      `SELECT id, tenant_id, crm_integration_id, call_uuid, caller_id, outcome, response_summary, error_detail, looked_up_at
       FROM crm_lookup_log
       WHERE crm_integration_id = $1 AND tenant_id = $2
       ORDER BY looked_up_at DESC
       LIMIT $3`,
      [crmIntegrationId, tenantId, limit],
    );
    return r.rows;
  }
}
