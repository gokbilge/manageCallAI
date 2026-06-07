import { describe, expect, it, vi } from 'vitest';
import type { TrunkGroupRepository } from './trunk-group.repository.js';
import {
  TrunkGroupService,
  TrunkGroupNotFoundError,
  RouteListNotFoundError,
  TrunkGroupMemberNotFoundError,
} from './trunk-group.service.js';
import type { TrunkGroupMember, TrunkGroupWithMembers, RouteListWithEntries } from './trunk-group.types.js';
import type { EnterpriseLifecycleService } from '../shared/enterprise-lifecycle.service.js';
import type { EnterpriseVersion, EnterprisePublishAttemptResult, EnterpriseDryRunResult } from '../shared/enterprise-lifecycle.types.js';

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

function makeVersion(overrides: Partial<EnterpriseVersion> = {}): EnterpriseVersion {
  return { id: 'ver-1', tenant_id: TENANT, object_id: GROUP_ID, version_number: 1, state: 'draft', definition: {}, created_by: null, created_at: new Date(), validated_at: null, simulated_at: null, published_at: null, metadata: {}, ...overrides };
}

function makeLifecycle(overrides: Partial<EnterpriseLifecycleService> = {}): EnterpriseLifecycleService {
  const v = makeVersion();
  const publishResult: EnterprisePublishAttemptResult = { status: 'published', version: makeVersion({ state: 'published' }) };
  const dryRun: EnterpriseDryRunResult = { dry_run: true, would_become: 'published', require_approval: false, version_state_valid: true, actor_type: 'user' };
  return {
    createVersion: vi.fn().mockResolvedValue(v),
    listVersions: vi.fn().mockResolvedValue([v]),
    validate: vi.fn().mockImplementation(async (_ot, _oid, _vid, _tid, validatorFn) => { const outcome = await validatorFn(v); return { version: v, outcome }; }),
    simulate: vi.fn().mockImplementation(async (_ot, _oid, _vid, _tid, _sc, simFn) => { const outcome = await simFn(v, {}); return { version: v, outcome }; }),
    dryRunPublish: vi.fn().mockResolvedValue(dryRun),
    publish: vi.fn().mockResolvedValue(publishResult),
    rollback: vi.fn().mockResolvedValue(publishResult),
    ...overrides,
  } as unknown as EnterpriseLifecycleService;
}

const groupWithMembers: TrunkGroupWithMembers = { ...group, members: [member] };

describe('TrunkGroupService — lifecycle', () => {
  it('createVersion delegates to lifecycle service', async () => {
    const lc = makeLifecycle();
    const svc = new TrunkGroupService(makeRepo(), lc);
    await svc.createVersion(GROUP_ID, TENANT, { x: 1 }, 'user-1');
    expect(lc.createVersion).toHaveBeenCalledWith('trunk_group', GROUP_ID, TENANT, { x: 1 }, 'user-1', undefined);
  });

  it('listVersions delegates to lifecycle service', async () => {
    const lc = makeLifecycle();
    const svc = new TrunkGroupService(makeRepo(), lc);
    const result = await svc.listVersions(GROUP_ID, TENANT);
    expect(result).toHaveLength(1);
  });

  it('validate passes when trunk group has members', async () => {
    const lc = makeLifecycle();
    const svc = new TrunkGroupService(makeRepo({ findGroupById: vi.fn().mockResolvedValue(groupWithMembers) }), lc);
    const result = await svc.validate(GROUP_ID, 'ver-1', TENANT);
    expect(result.outcome.status).toBe('passed');
    expect(result.outcome.errors).toHaveLength(0);
  });

  it('validate fails when trunk group has no members', async () => {
    const lc = makeLifecycle();
    const svc = new TrunkGroupService(makeRepo({ findGroupById: vi.fn().mockResolvedValue({ ...group, members: [] }) }), lc);
    const result = await svc.validate(GROUP_ID, 'ver-1', TENANT);
    expect(result.outcome.status).toBe('failed');
    expect(result.outcome.errors[0]!.field).toBe('members');
  });

  it('validate throws TrunkGroupNotFoundError when group missing', async () => {
    const lc = makeLifecycle();
    const svc = new TrunkGroupService(makeRepo({ findGroupById: vi.fn().mockResolvedValue(null) }), lc);
    await expect(svc.validate('missing', 'ver-1', TENANT)).rejects.toBeInstanceOf(TrunkGroupNotFoundError);
  });

  it('simulate delegates to lifecycle with simulateTrunkGroup result', async () => {
    const lc = makeLifecycle();
    const svc = new TrunkGroupService(makeRepo({ findTrunkNamesForGroup: vi.fn().mockResolvedValue([{ id: 'trunk-1', name: 'T1', priority: 10, weight: 1, status: 'active' }]) }), lc);
    const result = await svc.simulate(GROUP_ID, 'ver-1', TENANT, '+14155551234');
    expect(result.outcome).toMatchObject({ outcome: 'routed' });
  });

  it('dryRunPublish delegates to lifecycle service', async () => {
    const lc = makeLifecycle();
    const svc = new TrunkGroupService(makeRepo(), lc);
    const result = await svc.dryRunPublish(GROUP_ID, 'ver-1', TENANT);
    expect(result.would_become).toBe('published');
  });

  it('publish delegates to lifecycle service', async () => {
    const lc = makeLifecycle();
    const svc = new TrunkGroupService(makeRepo(), lc);
    const result = await svc.publish(GROUP_ID, 'ver-1', TENANT, 'user-1');
    expect(result.status).toBe('published');
  });

  it('rollback delegates to lifecycle service', async () => {
    const lc = makeLifecycle();
    const svc = new TrunkGroupService(makeRepo(), lc);
    const result = await svc.rollback(GROUP_ID, TENANT, 'user-1');
    expect(result.status).toBe('published');
  });

  it('lifecycle getter throws when lifecycleSvc not provided', async () => {
    const svc = new TrunkGroupService(makeRepo());
    expect(() => svc.createVersion(GROUP_ID, TENANT, {})).toThrow('EnterpriseLifecycleService not provided');
  });
});
