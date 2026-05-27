import type { Pool } from 'pg';
import type {
  AddMemberInput,
  CallGroup,
  CallGroupMember,
  CallGroupWithMembers,
  CreateCallGroupInput,
  UpdateCallGroupInput,
} from './call-group.types.js';

export class CallGroupRepository {
  constructor(private readonly db: Pool) {}

  async findAllByTenant(tenantId: string): Promise<CallGroup[]> {
    const r = await this.db.query<CallGroup>(
      `SELECT id, tenant_id, name, description, strategy, status, created_at, updated_at
       FROM call_groups WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [tenantId],
    );
    return r.rows;
  }

  async findById(id: string, tenantId: string): Promise<CallGroupWithMembers | null> {
    const groupR = await this.db.query<CallGroup>(
      `SELECT id, tenant_id, name, description, strategy, status, created_at, updated_at
       FROM call_groups WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (!groupR.rows[0]) return null;

    const membersR = await this.db.query<CallGroupMember>(
      `SELECT cgm.id, cgm.call_group_id, cgm.tenant_id, cgm.extension_id,
              e.extension_number, e.display_name, cgm.position, cgm.created_at
       FROM call_group_members cgm
       JOIN extensions e ON e.id = cgm.extension_id
       WHERE cgm.call_group_id = $1
       ORDER BY cgm.position, cgm.created_at`,
      [id],
    );
    return { ...groupR.rows[0]!, members: membersR.rows };
  }

  async create(input: CreateCallGroupInput): Promise<CallGroupWithMembers> {
    const r = await this.db.query<CallGroup>(
      `INSERT INTO call_groups (tenant_id, name, description, strategy)
       VALUES ($1, $2, $3, $4)
       RETURNING id, tenant_id, name, description, strategy, status, created_at, updated_at`,
      [input.tenant_id, input.name, input.description ?? null, input.strategy ?? 'simultaneous'],
    );
    return { ...r.rows[0]!, members: [] };
  }

  async update(id: string, tenantId: string, input: UpdateCallGroupInput): Promise<CallGroup | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.name !== undefined) { fields.push(`name = $${idx++}`); values.push(input.name); }
    if ('description' in input) { fields.push(`description = $${idx++}`); values.push(input.description ?? null); }
    if (input.strategy !== undefined) { fields.push(`strategy = $${idx++}`); values.push(input.strategy); }
    if (input.status !== undefined) { fields.push(`status = $${idx++}`); values.push(input.status); }

    if (fields.length === 0) {
      const r = await this.db.query<CallGroup>(
        `SELECT id, tenant_id, name, description, strategy, status, created_at, updated_at
         FROM call_groups WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId],
      );
      return r.rows[0] ?? null;
    }

    fields.push(`updated_at = NOW()`);
    values.push(id, tenantId);
    const r = await this.db.query<CallGroup>(
      `UPDATE call_groups SET ${fields.join(', ')}
       WHERE id = $${idx} AND tenant_id = $${idx + 1}
       RETURNING id, tenant_id, name, description, strategy, status, created_at, updated_at`,
      values,
    );
    return r.rows[0] ?? null;
  }

  async deactivate(id: string, tenantId: string): Promise<CallGroup | null> {
    const r = await this.db.query<CallGroup>(
      `UPDATE call_groups SET status = 'inactive', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, tenant_id, name, description, strategy, status, created_at, updated_at`,
      [id, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async findActiveExtension(extensionId: string, tenantId: string): Promise<{ id: string } | null> {
    const r = await this.db.query<{ id: string }>(
      `SELECT id FROM extensions WHERE id = $1 AND tenant_id = $2 AND status = 'active'`,
      [extensionId, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async addMember(groupId: string, tenantId: string, input: AddMemberInput): Promise<CallGroupMember> {
    const r = await this.db.query<CallGroupMember>(
      `INSERT INTO call_group_members (call_group_id, tenant_id, extension_id, position)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (call_group_id, extension_id) DO UPDATE SET position = EXCLUDED.position
       RETURNING id, call_group_id, tenant_id, extension_id, position, created_at`,
      [groupId, tenantId, input.extension_id, input.position ?? 0],
    );
    const row = r.rows[0]!;
    const extR = await this.db.query<{ extension_number: string; display_name: string }>(
      `SELECT extension_number, display_name FROM extensions WHERE id = $1`,
      [input.extension_id],
    );
    return { ...row, ...extR.rows[0]! };
  }

  async removeMember(groupId: string, extensionId: string, tenantId: string): Promise<boolean> {
    const r = await this.db.query(
      `DELETE FROM call_group_members
       WHERE call_group_id = $1 AND extension_id = $2
         AND tenant_id = (SELECT tenant_id FROM call_groups WHERE id = $1 AND tenant_id = $3 LIMIT 1)`,
      [groupId, extensionId, tenantId],
    );
    return (r.rowCount ?? 0) > 0;
  }

  async isActiveTarget(id: string, tenantId: string): Promise<boolean> {
    const r = await this.db.query<{ id: string }>(
      `SELECT id FROM call_groups WHERE id = $1 AND tenant_id = $2 AND status = 'active'`,
      [id, tenantId],
    );
    return r.rows.length > 0;
  }
}
