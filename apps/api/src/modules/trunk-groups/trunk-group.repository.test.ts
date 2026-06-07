import { describe, it, expect, vi } from 'vitest';
import type { Pool } from 'pg';
import { TrunkGroupRepository } from './trunk-group.repository.js';
import type { TrunkGroup, TrunkGroupMember, RouteList, RouteListEntry } from './trunk-group.types.js';

const TENANT = 'tenant-1';
const GROUP_ID = 'group-1';
const MEMBER_ID = 'member-1';
const TRUNK_ID = 'trunk-1';
const LIST_ID = 'list-1';
const ENTRY_ID = 'entry-1';

const baseGroup: TrunkGroup = {
  id: GROUP_ID, tenant_id: TENANT, name: 'Primary', description: null,
  selection_strategy: 'priority', status: 'active', created_at: new Date(), updated_at: new Date(),
};

const baseMember: TrunkGroupMember = {
  id: MEMBER_ID, tenant_id: TENANT, trunk_group_id: GROUP_ID,
  trunk_id: TRUNK_ID, priority: 100, weight: 1, created_at: new Date(),
};

const baseRouteList: RouteList = {
  id: LIST_ID, tenant_id: TENANT, name: 'Main Routes', description: null,
  status: 'active', created_at: new Date(), updated_at: new Date(),
};

const baseEntry: RouteListEntry = {
  id: ENTRY_ID, tenant_id: TENANT, route_list_id: LIST_ID,
  entry_type: 'trunk_group', entry_id: GROUP_ID, priority: 100, created_at: new Date(),
};

function makePool(rows: unknown[] = []): Pool {
  return { query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }) } as unknown as Pool;
}

describe('TrunkGroupRepository', () => {
  it('createGroup inserts group and returns it', async () => {
    const pool = makePool([baseGroup]);
    const repo = new TrunkGroupRepository(pool);
    const result = await repo.createGroup(TENANT, { name: 'Primary', selection_strategy: 'priority' });
    expect(result.name).toBe('Primary');
    expect(result.selection_strategy).toBe('priority');
  });

  it('findAllGroups returns all groups for tenant', async () => {
    const pool = makePool([baseGroup]);
    const repo = new TrunkGroupRepository(pool);
    const result = await repo.findAllGroups(TENANT);
    expect(result).toHaveLength(1);
  });

  it('findGroupById returns group with members when found', async () => {
    const pool = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [baseGroup] })
        .mockResolvedValueOnce({ rows: [baseMember] }),
    } as unknown as Pool;
    const repo = new TrunkGroupRepository(pool);
    const result = await repo.findGroupById(GROUP_ID, TENANT);
    expect(result?.id).toBe(GROUP_ID);
    expect(result?.members).toHaveLength(1);
  });

  it('findGroupById returns null when not found', async () => {
    const pool = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }),
    } as unknown as Pool;
    const repo = new TrunkGroupRepository(pool);
    expect(await repo.findGroupById('missing', TENANT)).toBeNull();
  });

  it('updateGroup builds dynamic SET and returns updated group', async () => {
    const updated = { ...baseGroup, name: 'Updated', selection_strategy: 'round_robin' as const };
    const pool = makePool([updated]);
    const repo = new TrunkGroupRepository(pool);
    const result = await repo.updateGroup(GROUP_ID, TENANT, {
      name: 'Updated', description: 'desc', selection_strategy: 'round_robin', status: 'inactive',
    });
    expect(result?.name).toBe('Updated');
  });

  it('updateGroup returns null when not found', async () => {
    const pool = makePool([]);
    const repo = new TrunkGroupRepository(pool);
    expect(await repo.updateGroup('missing', TENANT, { name: 'X' })).toBeNull();
  });

  it('deleteGroup returns true when deleted', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }) } as unknown as Pool;
    expect(await new TrunkGroupRepository(pool).deleteGroup(GROUP_ID, TENANT)).toBe(true);
  });

  it('deleteGroup returns false when not found', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) } as unknown as Pool;
    expect(await new TrunkGroupRepository(pool).deleteGroup('missing', TENANT)).toBe(false);
  });

  it('addMember upserts member and returns it', async () => {
    const pool = makePool([baseMember]);
    const repo = new TrunkGroupRepository(pool);
    const result = await repo.addMember(TENANT, GROUP_ID, { trunk_id: TRUNK_ID, priority: 100, weight: 1 });
    expect(result.trunk_id).toBe(TRUNK_ID);
    expect(result.priority).toBe(100);
  });

  it('removeMember returns true when deleted', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }) } as unknown as Pool;
    expect(await new TrunkGroupRepository(pool).removeMember(MEMBER_ID, GROUP_ID, TENANT)).toBe(true);
  });

  it('removeMember returns false when not found', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) } as unknown as Pool;
    expect(await new TrunkGroupRepository(pool).removeMember('missing', GROUP_ID, TENANT)).toBe(false);
  });

  it('findTrunkNamesForGroup returns trunk info for group', async () => {
    const pool = makePool([{ id: TRUNK_ID, name: 'Main Trunk', status: 'active', priority: 100 }]);
    const repo = new TrunkGroupRepository(pool);
    const result = await repo.findTrunkNamesForGroup(GROUP_ID, TENANT);
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('Main Trunk');
  });

  it('createRouteList inserts route list and returns it', async () => {
    const pool = makePool([baseRouteList]);
    const repo = new TrunkGroupRepository(pool);
    const result = await repo.createRouteList(TENANT, { name: 'Main Routes', description: 'desc' });
    expect(result.name).toBe('Main Routes');
  });

  it('findAllRouteLists returns all route lists for tenant', async () => {
    const pool = makePool([baseRouteList]);
    const repo = new TrunkGroupRepository(pool);
    const result = await repo.findAllRouteLists(TENANT);
    expect(result).toHaveLength(1);
  });

  it('findRouteListById returns list with entries when found', async () => {
    const pool = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [baseRouteList] })
        .mockResolvedValueOnce({ rows: [baseEntry] }),
    } as unknown as Pool;
    const repo = new TrunkGroupRepository(pool);
    const result = await repo.findRouteListById(LIST_ID, TENANT);
    expect(result?.id).toBe(LIST_ID);
    expect(result?.entries).toHaveLength(1);
  });

  it('findRouteListById returns null when not found', async () => {
    const pool = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }),
    } as unknown as Pool;
    const repo = new TrunkGroupRepository(pool);
    expect(await repo.findRouteListById('missing', TENANT)).toBeNull();
  });

  it('updateRouteList builds dynamic SET and returns updated list', async () => {
    const updated = { ...baseRouteList, name: 'Updated Routes' };
    const pool = makePool([updated]);
    const repo = new TrunkGroupRepository(pool);
    const result = await repo.updateRouteList(LIST_ID, TENANT, { name: 'Updated Routes', description: 'new', status: 'inactive' });
    expect(result?.name).toBe('Updated Routes');
  });

  it('updateRouteList returns null when not found', async () => {
    const pool = makePool([]);
    const repo = new TrunkGroupRepository(pool);
    expect(await repo.updateRouteList('missing', TENANT, { name: 'X' })).toBeNull();
  });

  it('deleteRouteList returns true when deleted', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }) } as unknown as Pool;
    expect(await new TrunkGroupRepository(pool).deleteRouteList(LIST_ID, TENANT)).toBe(true);
  });

  it('deleteRouteList returns false when not found', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) } as unknown as Pool;
    expect(await new TrunkGroupRepository(pool).deleteRouteList('missing', TENANT)).toBe(false);
  });

  it('addRouteListEntry upserts entry and returns it', async () => {
    const pool = makePool([baseEntry]);
    const repo = new TrunkGroupRepository(pool);
    const result = await repo.addRouteListEntry(TENANT, LIST_ID, { entry_type: 'trunk_group', entry_id: GROUP_ID, priority: 100 });
    expect(result.entry_id).toBe(GROUP_ID);
  });

  it('removeRouteListEntry returns true when deleted', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }) } as unknown as Pool;
    expect(await new TrunkGroupRepository(pool).removeRouteListEntry(ENTRY_ID, LIST_ID, TENANT)).toBe(true);
  });

  it('removeRouteListEntry returns false when not found', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) } as unknown as Pool;
    expect(await new TrunkGroupRepository(pool).removeRouteListEntry('missing', LIST_ID, TENANT)).toBe(false);
  });

  it('findSiteWithDefaults returns site when found', async () => {
    const pool = makePool([{ name: 'HQ', default_outbound_route_id: null }]);
    const repo = new TrunkGroupRepository(pool);
    const result = await repo.findSiteWithDefaults('site-1', TENANT);
    expect(result?.name).toBe('HQ');
  });

  it('findSiteWithDefaults returns null when not found', async () => {
    const pool = makePool([]);
    const repo = new TrunkGroupRepository(pool);
    expect(await repo.findSiteWithDefaults('missing', TENANT)).toBeNull();
  });

  it('findOutboundRouteTrunkInfo returns route when found', async () => {
    const pool = makePool([{ id: 'route-1', name: 'Main Route', sip_trunk_id: TRUNK_ID }]);
    const repo = new TrunkGroupRepository(pool);
    const result = await repo.findOutboundRouteTrunkInfo('route-1', TENANT);
    expect(result?.sip_trunk_id).toBe(TRUNK_ID);
  });

  it('findOutboundRouteTrunkInfo returns null when not found', async () => {
    const pool = makePool([]);
    const repo = new TrunkGroupRepository(pool);
    expect(await repo.findOutboundRouteTrunkInfo('missing', TENANT)).toBeNull();
  });
});
