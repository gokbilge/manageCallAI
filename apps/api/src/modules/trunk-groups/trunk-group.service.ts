import type { TrunkGroupRepository } from './trunk-group.repository.js';
import type {
  AddMemberInput,
  AddRouteListEntryInput,
  CarrierResolutionTrace,
  CreateRouteListInput,
  CreateTrunkGroupInput,
  RouteList,
  RouteListEntry,
  RouteListWithEntries,
  TrunkGroup,
  TrunkGroupMember,
  TrunkGroupSimulation,
  TrunkGroupWithMembers,
  TrunkSimulationStep,
  UpdateRouteListInput,
  UpdateTrunkGroupInput,
} from './trunk-group.types.js';
import type { EnterpriseLifecycleService } from '../shared/enterprise-lifecycle.service.js';
import type {
  EnterpriseVersion,
  EnterpriseValidationResult,
  EnterpriseSimulationResult,
  EnterpriseDryRunResult,
  EnterprisePublishAttemptResult,
} from '../shared/enterprise-lifecycle.types.js';
import type { Role } from '../auth/capabilities.js';

export class TrunkGroupNotFoundError extends Error {
  constructor(id: string) { super(`Trunk group not found: ${id}`); this.name = 'TrunkGroupNotFoundError'; }
}

export class RouteListNotFoundError extends Error {
  constructor(id: string) { super(`Route list not found: ${id}`); this.name = 'RouteListNotFoundError'; }
}

export class TrunkGroupMemberNotFoundError extends Error {
  constructor(id: string) { super(`Trunk group member not found: ${id}`); this.name = 'TrunkGroupMemberNotFoundError'; }
}

export class TrunkGroupService {
  constructor(
    private readonly repo: TrunkGroupRepository,
    private readonly lifecycleSvc?: EnterpriseLifecycleService,
  ) {}

  // ── Trunk groups ──────────────────────────────────────────────────────────

  createGroup(tenantId: string, input: CreateTrunkGroupInput): Promise<TrunkGroup> {
    return this.repo.createGroup(tenantId, input);
  }

  listGroups(tenantId: string): Promise<TrunkGroup[]> {
    return this.repo.findAllGroups(tenantId);
  }

  async getGroupById(id: string, tenantId: string): Promise<TrunkGroupWithMembers> {
    const group = await this.repo.findGroupById(id, tenantId);
    if (!group) throw new TrunkGroupNotFoundError(id);
    return group;
  }

  async updateGroup(id: string, tenantId: string, input: UpdateTrunkGroupInput): Promise<TrunkGroup> {
    const group = await this.repo.updateGroup(id, tenantId, input);
    if (!group) throw new TrunkGroupNotFoundError(id);
    return group;
  }

  async deleteGroup(id: string, tenantId: string): Promise<void> {
    const deleted = await this.repo.deleteGroup(id, tenantId);
    if (!deleted) throw new TrunkGroupNotFoundError(id);
  }

  async addMember(groupId: string, tenantId: string, input: AddMemberInput): Promise<TrunkGroupMember> {
    const group = await this.repo.findGroupById(groupId, tenantId);
    if (!group) throw new TrunkGroupNotFoundError(groupId);
    return this.repo.addMember(tenantId, groupId, input);
  }

  async removeMember(memberId: string, groupId: string, tenantId: string): Promise<void> {
    const deleted = await this.repo.removeMember(memberId, groupId, tenantId);
    if (!deleted) throw new TrunkGroupMemberNotFoundError(memberId);
  }

  // ── Route lists ───────────────────────────────────────────────────────────

  createRouteList(tenantId: string, input: CreateRouteListInput): Promise<RouteList> {
    return this.repo.createRouteList(tenantId, input);
  }

  listRouteLists(tenantId: string): Promise<RouteList[]> {
    return this.repo.findAllRouteLists(tenantId);
  }

  async getRouteListById(id: string, tenantId: string): Promise<RouteListWithEntries> {
    const list = await this.repo.findRouteListById(id, tenantId);
    if (!list) throw new RouteListNotFoundError(id);
    return list;
  }

  async updateRouteList(id: string, tenantId: string, input: UpdateRouteListInput): Promise<RouteList> {
    const list = await this.repo.updateRouteList(id, tenantId, input);
    if (!list) throw new RouteListNotFoundError(id);
    return list;
  }

  async deleteRouteList(id: string, tenantId: string): Promise<void> {
    const deleted = await this.repo.deleteRouteList(id, tenantId);
    if (!deleted) throw new RouteListNotFoundError(id);
  }

  async addRouteListEntry(routeListId: string, tenantId: string, input: AddRouteListEntryInput): Promise<RouteListEntry> {
    const list = await this.repo.findRouteListById(routeListId, tenantId);
    if (!list) throw new RouteListNotFoundError(routeListId);
    return this.repo.addRouteListEntry(tenantId, routeListId, input);
  }

  async removeRouteListEntry(entryId: string, routeListId: string, tenantId: string): Promise<void> {
    const list = await this.repo.findRouteListById(routeListId, tenantId);
    if (!list) throw new RouteListNotFoundError(routeListId);
    const deleted = await this.repo.removeRouteListEntry(entryId, routeListId, tenantId);
    if (!deleted) throw new TrunkGroupMemberNotFoundError(entryId);
  }

  // ── Failover-aware simulation (#306) ──────────────────────────────────────

  async simulateTrunkGroup(groupId: string, tenantId: string, dialString: string): Promise<TrunkGroupSimulation> {
    const group = await this.repo.findGroupById(groupId, tenantId);
    if (!group) throw new TrunkGroupNotFoundError(groupId);

    const trunks = await this.repo.findTrunkNamesForGroup(groupId, tenantId);

    if (trunks.length === 0) {
      return {
        trunk_group_id: groupId,
        trunk_group_name: group.name,
        selection_strategy: group.selection_strategy,
        dial_string: dialString,
        outcome: 'no_trunks',
        selected_trunk_id: null,
        steps: [],
        is_advisory: true,
        simulated_at: new Date().toISOString(),
      };
    }

    const sorted = [...trunks].sort((a, b) => a.priority - b.priority);
    const steps: TrunkSimulationStep[] = [];
    let selectedTrunkId: string | null = null;

    for (let i = 0; i < sorted.length; i++) {
      const trunk = sorted[i]!;
      const isActive = trunk.status === 'active';
      const role: 'primary' | 'failover' = i === 0 ? 'primary' : 'failover';

      steps.push({
        trunk_id: trunk.id,
        trunk_name: trunk.name,
        role,
        priority: trunk.priority,
        would_attempt: isActive && selectedTrunkId === null,
        failover_reason: isActive ? null : `Trunk "${trunk.name}" is ${trunk.status} — skipped.`,
      });

      if (isActive && selectedTrunkId === null) {
        selectedTrunkId = trunk.id;
      }
    }

    return {
      trunk_group_id: groupId,
      trunk_group_name: group.name,
      selection_strategy: group.selection_strategy,
      dial_string: dialString,
      outcome: selectedTrunkId ? 'routed' : 'all_failed',
      selected_trunk_id: selectedTrunkId,
      steps,
      is_advisory: true,
      simulated_at: new Date().toISOString(),
    };
  }

  // ── Site-aware carrier resolution (#307) ──────────────────────────────────

  async resolveCarrierForSite(tenantId: string, dialString: string, siteId?: string | null): Promise<CarrierResolutionTrace> {
    const path: string[] = [];
    let siteName: string | null = null;
    let defaultOutboundRouteId: string | null = null;
    let resolvedTrunkId: string | null = null;

    if (siteId) {
      const site = await this.repo.findSiteWithDefaults(siteId, tenantId);
      if (site) {
        siteName = site.name;
        defaultOutboundRouteId = site.default_outbound_route_id;
        path.push(`Site "${site.name}" found.`);

        if (defaultOutboundRouteId) {
          path.push(`Site has default outbound route (${defaultOutboundRouteId}).`);
          const route = await this.repo.findOutboundRouteTrunkInfo(defaultOutboundRouteId, tenantId);
          if (route?.sip_trunk_id) {
            resolvedTrunkId = route.sip_trunk_id;
            path.push(`Resolved to trunk ${route.sip_trunk_id} via site default route "${route.name}".`);
          } else {
            path.push(`Site default route found but has no trunk assigned.`);
          }
        } else {
          path.push(`Site has no default outbound route — falling back to global routing.`);
        }
      } else {
        path.push(`Site ${siteId} not found — using global routing.`);
      }
    } else {
      path.push(`No site specified — using global routing.`);
    }

    if (!resolvedTrunkId) {
      path.push(`No site-local carrier resolved for "${dialString}". Operator must configure global outbound route or site default.`);
    }

    return {
      site_id: siteId ?? null,
      site_name: siteName,
      dial_string: dialString,
      default_outbound_route_id: defaultOutboundRouteId,
      resolved_trunk_group_id: null,
      resolved_trunk_id: resolvedTrunkId,
      resolution_path: path,
      is_advisory: true,
      resolved_at: new Date().toISOString(),
    };
  }

  // ── Publish lifecycle (#319, #321) ────────────────────────────────────────

  private get lifecycle(): EnterpriseLifecycleService {
    if (!this.lifecycleSvc) throw new Error('EnterpriseLifecycleService not provided');
    return this.lifecycleSvc;
  }

  createVersion(groupId: string, tenantId: string, definition: Record<string, unknown>, createdBy?: string, metadata?: Record<string, unknown>): Promise<EnterpriseVersion> {
    return this.lifecycle.createVersion('trunk_group', groupId, tenantId, definition, createdBy, metadata);
  }

  listVersions(groupId: string, tenantId: string): Promise<EnterpriseVersion[]> {
    return this.lifecycle.listVersions('trunk_group', groupId, tenantId);
  }

  async validate(groupId: string, versionId: string, tenantId: string): Promise<EnterpriseValidationResult> {
    const group = await this.repo.findGroupById(groupId, tenantId);
    if (!group) throw new TrunkGroupNotFoundError(groupId);
    return this.lifecycle.validate('trunk_group', groupId, versionId, tenantId, async () => {
      const errors: { field: string; message: string }[] = [];
      const members = group.members;
      if (members.length === 0) {
        errors.push({ field: 'members', message: 'Trunk group has no members; at least one trunk member is required before publish.' });
      }
      return { status: errors.length === 0 ? 'passed' : 'failed', errors, warnings: [] };
    });
  }

  async simulate(groupId: string, versionId: string, tenantId: string, dialString: string): Promise<EnterpriseSimulationResult> {
    const simulation = await this.simulateTrunkGroup(groupId, tenantId, dialString);
    const outcome = {
      status: simulation.outcome === 'routed' ? 'passed' : 'failed',
      ...simulation,
    };
    return this.lifecycle.simulate('trunk_group', groupId, versionId, tenantId, { dial_string: dialString }, async () => outcome);
  }

  dryRunPublish(groupId: string, versionId: string, tenantId: string, actorType: 'user' | 'workflow' | 'ai_agent' | 'system' = 'user', actorRole?: Role): Promise<EnterpriseDryRunResult> {
    return this.lifecycle.dryRunPublish('trunk_group', groupId, versionId, tenantId, actorType, actorRole);
  }

  publish(groupId: string, versionId: string, tenantId: string, triggeredById: string, actorRole?: Role, actorType: 'user' | 'workflow' | 'ai_agent' | 'system' = 'user'): Promise<EnterprisePublishAttemptResult> {
    return this.lifecycle.publish('trunk_group', groupId, versionId, tenantId, triggeredById, actorRole, actorType);
  }

  rollback(groupId: string, tenantId: string, triggeredById: string, actorRole?: Role, actorType: 'user' | 'workflow' | 'ai_agent' | 'system' = 'user'): Promise<EnterprisePublishAttemptResult> {
    return this.lifecycle.rollback('trunk_group', groupId, tenantId, triggeredById, actorRole, actorType);
  }
}
