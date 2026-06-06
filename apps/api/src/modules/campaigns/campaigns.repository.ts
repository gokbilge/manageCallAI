import type { Pool } from 'pg';
import type {
  AddCampaignContactInput,
  AssignCampaignAgentInput,
  Campaign,
  CampaignAssignment,
  CampaignContact,
  CampaignStatus,
  CreateCampaignInput,
  UpdateCampaignInput,
} from './campaigns.types.js';

const CAMPAIGN_COLUMNS = `id, tenant_id, name, description, campaign_type, status,
  outbound_route_id, max_concurrent_calls, schedule_start_time, schedule_end_time,
  schedule_timezone, started_at, completed_at, created_at, updated_at`;

const CONTACT_COLUMNS = `id, tenant_id, campaign_id, phone_number, display_name,
  context, dial_state, attempt_count, last_attempted_at, created_at`;

export class CampaignsRepository {
  constructor(private readonly db: Pool) {}

  // ── Campaigns ─────────────────────────────────────────────────────────────

  async findAllByTenant(tenantId: string): Promise<Campaign[]> {
    const r = await this.db.query<Campaign>(
      `SELECT ${CAMPAIGN_COLUMNS} FROM campaigns WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return r.rows;
  }

  async findById(id: string, tenantId: string): Promise<Campaign | null> {
    const r = await this.db.query<Campaign>(
      `SELECT ${CAMPAIGN_COLUMNS} FROM campaigns WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async create(input: CreateCampaignInput): Promise<Campaign> {
    const r = await this.db.query<Campaign>(
      `INSERT INTO campaigns (
         tenant_id, name, description, campaign_type, outbound_route_id,
         max_concurrent_calls, schedule_start_time, schedule_end_time, schedule_timezone
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${CAMPAIGN_COLUMNS}`,
      [
        input.tenant_id,
        input.name,
        input.description ?? null,
        input.campaign_type ?? 'outbound_preview',
        input.outbound_route_id ?? null,
        input.max_concurrent_calls ?? 1,
        input.schedule_start_time ?? null,
        input.schedule_end_time ?? null,
        input.schedule_timezone ?? 'UTC',
      ],
    );
    return r.rows[0]!;
  }

  async update(id: string, tenantId: string, input: UpdateCampaignInput): Promise<Campaign | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.name !== undefined) { fields.push(`name = $${idx++}`); values.push(input.name); }
    if ('description' in input) { fields.push(`description = $${idx++}`); values.push(input.description ?? null); }
    if ('outbound_route_id' in input) { fields.push(`outbound_route_id = $${idx++}`); values.push(input.outbound_route_id ?? null); }
    if (input.max_concurrent_calls !== undefined) { fields.push(`max_concurrent_calls = $${idx++}`); values.push(input.max_concurrent_calls); }
    if ('schedule_start_time' in input) { fields.push(`schedule_start_time = $${idx++}`); values.push(input.schedule_start_time ?? null); }
    if ('schedule_end_time' in input) { fields.push(`schedule_end_time = $${idx++}`); values.push(input.schedule_end_time ?? null); }
    if (input.schedule_timezone !== undefined) { fields.push(`schedule_timezone = $${idx++}`); values.push(input.schedule_timezone); }

    if (fields.length === 0) return this.findById(id, tenantId);

    fields.push('updated_at = NOW()');
    values.push(id, tenantId);
    const r = await this.db.query<Campaign>(
      `UPDATE campaigns SET ${fields.join(', ')}
       WHERE id = $${idx} AND tenant_id = $${idx + 1}
       RETURNING ${CAMPAIGN_COLUMNS}`,
      values,
    );
    return r.rows[0] ?? null;
  }

  async setStatus(id: string, tenantId: string, status: CampaignStatus, timestampField?: 'started_at' | 'completed_at'): Promise<Campaign | null> {
    const extra = timestampField ? `, ${timestampField} = NOW()` : '';
    const r = await this.db.query<Campaign>(
      `UPDATE campaigns SET status = $1${extra}, updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3
       RETURNING ${CAMPAIGN_COLUMNS}`,
      [status, id, tenantId],
    );
    return r.rows[0] ?? null;
  }

  // ── Contacts ──────────────────────────────────────────────────────────────

  async findContacts(campaignId: string, tenantId: string): Promise<CampaignContact[]> {
    const r = await this.db.query<CampaignContact>(
      `SELECT ${CONTACT_COLUMNS} FROM campaign_contacts
       WHERE campaign_id = $1 AND tenant_id = $2
       ORDER BY created_at`,
      [campaignId, tenantId],
    );
    return r.rows;
  }

  async addContact(campaignId: string, tenantId: string, input: AddCampaignContactInput): Promise<CampaignContact> {
    const r = await this.db.query<CampaignContact>(
      `INSERT INTO campaign_contacts (tenant_id, campaign_id, phone_number, display_name, context)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, campaign_id, phone_number)
       DO UPDATE SET display_name = EXCLUDED.display_name, context = EXCLUDED.context
       RETURNING ${CONTACT_COLUMNS}`,
      [tenantId, campaignId, input.phone_number, input.display_name ?? null, JSON.stringify(input.context ?? {})],
    );
    return r.rows[0]!;
  }

  async removeContact(campaignId: string, contactId: string, tenantId: string): Promise<boolean> {
    const r = await this.db.query(
      `DELETE FROM campaign_contacts WHERE id = $1 AND campaign_id = $2 AND tenant_id = $3`,
      [contactId, campaignId, tenantId],
    );
    return (r.rowCount ?? 0) > 0;
  }

  // ── Assignments ───────────────────────────────────────────────────────────

  async findAssignments(campaignId: string, tenantId: string): Promise<CampaignAssignment[]> {
    const r = await this.db.query<CampaignAssignment>(
      `SELECT id, tenant_id, campaign_id, agent_profile_id, assigned_at
       FROM campaign_assignments WHERE campaign_id = $1 AND tenant_id = $2`,
      [campaignId, tenantId],
    );
    return r.rows;
  }

  async assignAgent(campaignId: string, tenantId: string, input: AssignCampaignAgentInput): Promise<CampaignAssignment> {
    const r = await this.db.query<CampaignAssignment>(
      `INSERT INTO campaign_assignments (tenant_id, campaign_id, agent_profile_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, campaign_id, agent_profile_id) DO UPDATE SET assigned_at = campaign_assignments.assigned_at
       RETURNING id, tenant_id, campaign_id, agent_profile_id, assigned_at`,
      [tenantId, campaignId, input.agent_profile_id],
    );
    return r.rows[0]!;
  }

  async removeAgent(campaignId: string, agentProfileId: string, tenantId: string): Promise<boolean> {
    const r = await this.db.query(
      `DELETE FROM campaign_assignments WHERE campaign_id = $1 AND agent_profile_id = $2 AND tenant_id = $3`,
      [campaignId, agentProfileId, tenantId],
    );
    return (r.rowCount ?? 0) > 0;
  }
}
