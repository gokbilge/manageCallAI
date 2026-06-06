import { describe, expect, it, vi } from 'vitest';
import type { TrunkGroupRepository } from './trunk-group.repository.js';
import {
  TrunkGroupService,
  TrunkGroupNotFoundError,
  RouteListNotFoundError,
  TrunkGroupMemberNotFoundError,
} from './trunk-group.service.js';
import type { TrunkGroupMember, TrunkGroupWithMembers, RouteListWithEntries } from './trunk-group.types.js';

const TENANT = 'tenant-1';
const GROUP_ID = 'group-1';
const LIST_ID = 'list-1';

const group: TrunkGroupWithMembers = {
  id: GROUP_ID, tenant_id: TENANT, name: 'Primary Carriers', description: null,
  selection_strategy: 'priority', status: 'active',
  created_at: new Date(), updated_at: new Date(),
  members: [],
};

const member: TrunkGroupMember = {
  id: 'member-1', tenant_id: TENANT, trunk_group_id: GROUP_ID,
  trunk_id: 'trunk-1', priority: 100, weight: 1, created_at: new Date(),
};

const routeList: RouteListWithEntries = {
  id: LIST_ID, tenant_id: TENANT, name: 'Failover List', description: null,
  status: 'active', created_at: new Date(), updated_at: new Date(), entries: [],
};

function makeRepo(overrides: Partial<TrunkGroupRepository> = {}): TrunkGroupRepository {
  return {
    createGroup: vi.fn().mockResolvedValue(group),
    findAllGroups: vi.fn().mockResolvedValue([group]),
    findGroupById: vi.fn().mockResolvedValue(group),
    updateGroup: vi.fn().mockResolvedValue({ ...group, name: 'Updated' }),
    deleteGroup: vi.fn().mockResolvedValue(true),
    addMember: vi.fn().mockResolvedValue(member),
    removeMember: vi.fn().mockResolvedValue(true),
    findTrunkNamesForGroup: vi.fn().mockResolvedValue([
      { id: 'trunk-1', name: 'Carrier A', status: 'active', priority: 100 },
      { id: 'trunk-2', name: 'Carrier B', status: 'active', priority: 200 },
    ]),
    createRouteList: vi.fn().mockResolvedValue(routeList),
    findAllRouteLists: vi.fn().mockResolvedValue([routeList]),
    findRouteListById: vi.fn().mockResolvedValue(routeList),
    updateRouteList: vi.fn().mockResolvedValue({ ...routeList, name: 'Updated' }),
    deleteRouteList: vi.fn().mockResolvedValue(true),
    addRouteListEntry: vi.fn().mockResolvedValue({ id: 'e-1', tenant_id: TENANT, route_list_id: LIST_ID, entry_type: 'sip_trunk', entry_id: 'trunk-1', priority: 100, created_at: new Date() }),
    removeRouteListEntry: vi.fn().mockResolvedValue(true),
    findSiteWithDefaults: vi.fn().mockResolvedValue({ name: 'HQ', default_outbound_route_id: 'route-1' }),
    findOutboundRouteTrunkInfo: vi.fn().mockResolvedValue({ id: 'route-1', name: 'Default Route', sip_trunk_id: 'trunk-1' }),
    ...overrides,
  } as unknown as TrunkGroupRepository;
}

describe('TrunkGroupService', () => {
  it('creates a trunk group', async () => {
    const svc = new TrunkGroupService(makeRepo());
    const r = await svc.createGroup(TENANT, { name: 'Primary Carriers' });
    expect(r.name).toBe('Primary Carriers');
  });

  it('lists trunk groups', async () => {
    const svc = new TrunkGroupService(makeRepo());
    expect(await svc.listGroups(TENANT)).toHaveLength(1);
  });

  it('gets a trunk group with members', async () => {
    const svc = new TrunkGroupService(makeRepo());
    const r = await svc.getGroupById(GROUP_ID, TENANT);
    expect(r.members).toBeDefined();
  });

  it('throws TrunkGroupNotFoundError when group missing', async () => {
    const svc = new TrunkGroupService(makeRepo({ findGroupById: vi.fn().mockResolvedValue(null) }));
    await expect(svc.getGroupById('missing', TENANT)).rejects.toBeInstanceOf(TrunkGroupNotFoundError);
  });

  it('adds a member to a trunk group', async () => {
    const svc = new TrunkGroupService(makeRepo());
    const r = await svc.addMember(GROUP_ID, TENANT, { trunk_id: 'trunk-1', priority: 100 });
    expect(r.trunk_id).toBe('trunk-1');
  });

  it('throws TrunkGroupMemberNotFoundError when removing missing member', async () => {
    const svc = new TrunkGroupService(makeRepo({ removeMember: vi.fn().mockResolvedValue(false) }));
    await expect(svc.removeMember('missing', GROUP_ID, TENANT)).rejects.toBeInstanceOf(TrunkGroupMemberNotFoundError);
  });

  // ── Simulation (#306) ──────────────────────────────────────────────────────

  it('simulates trunk group — selects primary active trunk', async () => {
    const svc = new TrunkGroupService(makeRepo());
    const result = await svc.simulateTrunkGroup(GROUP_ID, TENANT, '+14155551234');

    expect(result.outcome).toBe('routed');
    expect(result.selected_trunk_id).toBe('trunk-1');
    expect(result.steps[0]!.role).toBe('primary');
    expect(result.steps[1]!.role).toBe('failover');
    expect(result.is_advisory).toBe(true);
  });

  it('simulation outcome is no_trunks when group is empty', async () => {
    const svc = new TrunkGroupService(makeRepo({ findTrunkNamesForGroup: vi.fn().mockResolvedValue([]) }));
    const result = await svc.simulateTrunkGroup(GROUP_ID, TENANT, '+14155551234');
    expect(result.outcome).toBe('no_trunks');
    expect(result.selected_trunk_id).toBeNull();
  });

  it('simulation skips inactive trunks and selects next available', async () => {
    const svc = new TrunkGroupService(makeRepo({
      findTrunkNamesForGroup: vi.fn().mockResolvedValue([
        { id: 'trunk-1', name: 'Down Carrier', status: 'inactive', priority: 100 },
        { id: 'trunk-2', name: 'Backup Carrier', status: 'active', priority: 200 },
      ]),
    }));
    const result = await svc.simulateTrunkGroup(GROUP_ID, TENANT, '+14155551234');
    expect(result.outcome).toBe('routed');
    expect(result.selected_trunk_id).toBe('trunk-2');
    expect(result.steps[0]!.failover_reason).toContain('inactive');
  });

  it('simulation outcome is all_failed when all trunks inactive', async () => {
    const svc = new TrunkGroupService(makeRepo({
      findTrunkNamesForGroup: vi.fn().mockResolvedValue([
        { id: 'trunk-1', name: 'Dead A', status: 'inactive', priority: 100 },
        { id: 'trunk-2', name: 'Dead B', status: 'inactive', priority: 200 },
      ]),
    }));
    const result = await svc.simulateTrunkGroup(GROUP_ID, TENANT, '+14155551234');
    expect(result.outcome).toBe('all_failed');
  });

  // ── Carrier resolution (#307) ──────────────────────────────────────────────

  it('resolves carrier from site default outbound route', async () => {
    const svc = new TrunkGroupService(makeRepo());
    const result = await svc.resolveCarrierForSite(TENANT, '+14155551234', 'site-1');

    expect(result.site_name).toBe('HQ');
    expect(result.resolved_trunk_id).toBe('trunk-1');
    expect(result.is_advisory).toBe(true);
    expect(result.resolution_path.length).toBeGreaterThan(0);
  });

  it('resolution falls back gracefully when site not found', async () => {
    const svc = new TrunkGroupService(makeRepo({ findSiteWithDefaults: vi.fn().mockResolvedValue(null) }));
    const result = await svc.resolveCarrierForSite(TENANT, '+14155551234', 'missing-site');
    expect(result.resolved_trunk_id).toBeNull();
    expect(result.resolution_path.some(p => p.includes('not found'))).toBe(true);
  });

  it('resolution works without site_id — global routing', async () => {
    const svc = new TrunkGroupService(makeRepo());
    const result = await svc.resolveCarrierForSite(TENANT, '+14155551234', null);
    expect(result.site_id).toBeNull();
    expect(result.resolution_path[0]).toContain('No site specified');
  });

  // ── Route lists ────────────────────────────────────────────────────────────

  it('creates a route list', async () => {
    const svc = new TrunkGroupService(makeRepo());
    const r = await svc.createRouteList(TENANT, { name: 'Failover List' });
    expect(r.name).toBe('Failover List');
  });

  it('adds and removes a route list entry', async () => {
    const svc = new TrunkGroupService(makeRepo());
    const entry = await svc.addRouteListEntry(LIST_ID, TENANT, { entry_type: 'sip_trunk', entry_id: 'trunk-1' });
    expect(entry.entry_type).toBe('sip_trunk');

    await expect(svc.removeRouteListEntry('e-1', LIST_ID, TENANT)).resolves.toBeUndefined();
  });

  it('throws RouteListNotFoundError when list missing', async () => {
    const svc = new TrunkGroupService(makeRepo({ findRouteListById: vi.fn().mockResolvedValue(null) }));
    await expect(svc.getRouteListById('missing', TENANT)).rejects.toBeInstanceOf(RouteListNotFoundError);
  });
});
