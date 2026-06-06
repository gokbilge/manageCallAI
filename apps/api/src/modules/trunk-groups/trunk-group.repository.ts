import type { Pool } from 'pg';
import type {
  AddMemberInput,
  AddRouteListEntryInput,
  CreateRouteListInput,
  CreateTrunkGroupInput,
  RouteList,
  RouteListEntry,
  RouteListWithEntries,
  TrunkGroup,
  TrunkGroupMember,
  TrunkGroupWithMembers,
  UpdateRouteListInput,
  UpdateTrunkGroupInput,
} from './trunk-group.types.js';

const groupCols = `id, tenant_id, name, description, selection_strategy, status, created_at, updated_at`;
const memberCols = `id, tenant_id, trunk_group_id, trunk_id, priority, weight, created_at`;
const listCols = `id, tenant_id, name, description, status, created_at, updated_at`;
const entryCols = `id, tenant_id, route_list_id, entry_type, entry_id, priority, created_at`;

export class TrunkGroupRepository {
  constructor(private readonly db: Pool) {}

  // ── Trunk groups ──────────────────────────────────────────────────────────

  async createGroup(tenantId: string, input: CreateTrunkGroupInput): Promise<TrunkGroup> {
    const r = await this.db.query<TrunkGroup>(
      `INSERT INTO trunk_groups (tenant_id, name, description, selection_strategy)
       VALUES ($1, $2, $3, $4) RETURNING ${groupCols}`,
      [tenantId, input.name, input.description ?? null, input.selection_strategy ?? 'priority'],
    );
    return r.rows[0]!;
  }

  async findAllGroups(tenantId: string): Promise<TrunkGroup[]> {
    const r = await this.db.query<TrunkGroup>(
      `SELECT ${groupCols} FROM trunk_groups WHERE tenant_id = $1 ORDER BY name`,
      [tenantId],
    );
    return r.rows;
  }

  async findGroupById(id: string, tenantId: string): Promise<TrunkGroupWithMembers | null> {
    const [gR, mR] = await Promise.all([
      this.db.query<TrunkGroup>(`SELECT ${groupCols} FROM trunk_groups WHERE id = $1 AND tenant_id = $2`, [id, tenantId]),
      this.db.query<TrunkGroupMember>(`SELECT ${memberCols} FROM trunk_group_members WHERE trunk_group_id = $1 AND tenant_id = $2 ORDER BY priority`, [id, tenantId]),
    ]);
    if (!gR.rows[0]) return null;
    return { ...gR.rows[0], members: mR.rows };
  }

  async updateGroup(id: string, tenantId: string, input: UpdateTrunkGroupInput): Promise<TrunkGroup | null> {
    const sets: string[] = ['updated_at = NOW()'];
    const vals: unknown[] = [id, tenantId];
    let i = 3;
    if (input.name !== undefined)               { sets.push(`name = $${i}`);               vals.push(input.name);               i++; }
    if (input.description !== undefined)        { sets.push(`description = $${i}`);        vals.push(input.description);        i++; }
    if (input.selection_strategy !== undefined) { sets.push(`selection_strategy = $${i}`); vals.push(input.selection_strategy); i++; }
    if (input.status !== undefined)             { sets.push(`status = $${i}`);             vals.push(input.status);             i++; }
    const r = await this.db.query<TrunkGroup>(
      `UPDATE trunk_groups SET ${sets.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING ${groupCols}`,
      vals,
    );
    return r.rows[0] ?? null;
  }

  async deleteGroup(id: string, tenantId: string): Promise<boolean> {
    const r = await this.db.query(`DELETE FROM trunk_groups WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    return (r.rowCount ?? 0) > 0;
  }

  async addMember(tenantId: string, groupId: string, input: AddMemberInput): Promise<TrunkGroupMember> {
    const r = await this.db.query<TrunkGroupMember>(
      `INSERT INTO trunk_group_members (tenant_id, trunk_group_id, trunk_id, priority, weight)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (trunk_group_id, trunk_id) DO UPDATE SET priority = EXCLUDED.priority, weight = EXCLUDED.weight
       RETURNING ${memberCols}`,
      [tenantId, groupId, input.trunk_id, input.priority ?? 100, input.weight ?? 1],
    );
    return r.rows[0]!;
  }

  async removeMember(memberId: string, groupId: string, tenantId: string): Promise<boolean> {
    const r = await this.db.query(
      `DELETE FROM trunk_group_members WHERE id = $1 AND trunk_group_id = $2 AND tenant_id = $3`,
      [memberId, groupId, tenantId],
    );
    return (r.rowCount ?? 0) > 0;
  }

  async findTrunkNamesForGroup(groupId: string, tenantId: string): Promise<Array<{ id: string; name: string; status: string; priority: number }>> {
    const r = await this.db.query<{ id: string; name: string; status: string; priority: number }>(
      `SELECT st.id, st.name, st.status, tgm.priority
       FROM trunk_group_members tgm
       JOIN sip_trunks st ON st.id = tgm.trunk_id AND st.tenant_id = tgm.tenant_id
       WHERE tgm.trunk_group_id = $1 AND tgm.tenant_id = $2
       ORDER BY tgm.priority`,
      [groupId, tenantId],
    );
    return r.rows;
  }

  // ── Route lists ───────────────────────────────────────────────────────────

  async createRouteList(tenantId: string, input: CreateRouteListInput): Promise<RouteList> {
    const r = await this.db.query<RouteList>(
      `INSERT INTO route_lists (tenant_id, name, description) VALUES ($1, $2, $3) RETURNING ${listCols}`,
      [tenantId, input.name, input.description ?? null],
    );
    return r.rows[0]!;
  }

  async findAllRouteLists(tenantId: string): Promise<RouteList[]> {
    const r = await this.db.query<RouteList>(
      `SELECT ${listCols} FROM route_lists WHERE tenant_id = $1 ORDER BY name`,
      [tenantId],
    );
    return r.rows;
  }

  async findRouteListById(id: string, tenantId: string): Promise<RouteListWithEntries | null> {
    const [lR, eR] = await Promise.all([
      this.db.query<RouteList>(`SELECT ${listCols} FROM route_lists WHERE id = $1 AND tenant_id = $2`, [id, tenantId]),
      this.db.query<RouteListEntry>(`SELECT ${entryCols} FROM route_list_entries WHERE route_list_id = $1 AND tenant_id = $2 ORDER BY priority`, [id, tenantId]),
    ]);
    if (!lR.rows[0]) return null;
    return { ...lR.rows[0], entries: eR.rows };
  }

  async updateRouteList(id: string, tenantId: string, input: UpdateRouteListInput): Promise<RouteList | null> {
    const sets: string[] = ['updated_at = NOW()'];
    const vals: unknown[] = [id, tenantId];
    let i = 3;
    if (input.name !== undefined)        { sets.push(`name = $${i}`);        vals.push(input.name);        i++; }
    if (input.description !== undefined) { sets.push(`description = $${i}`); vals.push(input.description); i++; }
    if (input.status !== undefined)      { sets.push(`status = $${i}`);      vals.push(input.status);      i++; }
    const r = await this.db.query<RouteList>(
      `UPDATE route_lists SET ${sets.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING ${listCols}`,
      vals,
    );
    return r.rows[0] ?? null;
  }

  async deleteRouteList(id: string, tenantId: string): Promise<boolean> {
    const r = await this.db.query(`DELETE FROM route_lists WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    return (r.rowCount ?? 0) > 0;
  }

  async addRouteListEntry(tenantId: string, routeListId: string, input: AddRouteListEntryInput): Promise<RouteListEntry> {
    const r = await this.db.query<RouteListEntry>(
      `INSERT INTO route_list_entries (tenant_id, route_list_id, entry_type, entry_id, priority)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (route_list_id, entry_type, entry_id) DO UPDATE SET priority = EXCLUDED.priority
       RETURNING ${entryCols}`,
      [tenantId, routeListId, input.entry_type, input.entry_id, input.priority ?? 100],
    );
    return r.rows[0]!;
  }

  async removeRouteListEntry(entryId: string, routeListId: string, tenantId: string): Promise<boolean> {
    const r = await this.db.query(
      `DELETE FROM route_list_entries WHERE id = $1 AND route_list_id = $2 AND tenant_id = $3`,
      [entryId, routeListId, tenantId],
    );
    return (r.rowCount ?? 0) > 0;
  }

  // ── Site-aware carrier lookup (#307) ──────────────────────────────────────

  async findSiteWithDefaults(siteId: string, tenantId: string): Promise<{ name: string; default_outbound_route_id: string | null } | null> {
    const r = await this.db.query<{ name: string; default_outbound_route_id: string | null }>(
      `SELECT name, default_outbound_route_id FROM sites WHERE id = $1 AND tenant_id = $2`,
      [siteId, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async findOutboundRouteTrunkInfo(routeId: string, tenantId: string): Promise<{ id: string; name: string; sip_trunk_id: string | null } | null> {
    const r = await this.db.query<{ id: string; name: string; sip_trunk_id: string | null }>(
      `SELECT id, name, sip_trunk_id FROM outbound_routes WHERE id = $1 AND tenant_id = $2`,
      [routeId, tenantId],
    );
    return r.rows[0] ?? null;
  }
}
