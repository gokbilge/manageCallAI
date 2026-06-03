import type {
  ApplyResultInput,
  PendingApplyRequest,
  RuntimeApplyActionType,
  RuntimeApplyRequest,
} from './runtime-apply.types.js';
import { RUNTIME_APPLY_ACTION_TYPES } from './runtime-apply.types.js';
import type { RuntimeApplyRepository } from './runtime-apply.repository.js';

export class RuntimeApplyNotFoundError extends Error {
  constructor(id: string) {
    super(`Runtime apply request not found: ${id}`);
    this.name = 'RuntimeApplyNotFoundError';
  }
}

export class RuntimeApplyActionNotAllowedError extends Error {
  constructor(action: string) {
    super(`Action type not in allowlist: ${action}`);
    this.name = 'RuntimeApplyActionNotAllowedError';
  }
}

export class RuntimeApplyService {
  constructor(private readonly repo: RuntimeApplyRepository) {}

  // Called after trunk create/update/deactivate to fan-out apply requests.
  async createForTrunkChange(input: {
    tenantId: string;
    trunkId: string;
    actorId: string | null;
    triggeredBy: 'user' | 'system';
  }): Promise<RuntimeApplyRequest[]> {
    const nodes = await this.repo.listActiveNodes();
    if (nodes.length === 0) return [];

    const results: RuntimeApplyRequest[] = [];
    for (const node of nodes) {
      // Primary action: rescan gateways on the external profile.
      // This safely reloads gateway config without dropping active calls.
      const req = await this.repo.create({
        tenant_id: input.tenantId,
        triggered_by_type: input.triggeredBy,
        triggered_by_id: input.actorId,
        action_type: 'sofia_profile_rescan',
        target_node_id: node.id,
        target_profile: 'external',
        target_gateway: `trunk-${input.trunkId}`,
        object_type: 'sip_trunk',
        object_id: input.trunkId,
      });
      results.push(req);
    }
    return results;
  }

  async listByTrunk(tenantId: string, trunkId: string): Promise<RuntimeApplyRequest[]> {
    return this.repo.findByTrunk(tenantId, trunkId);
  }

  async getById(id: string, tenantId: string): Promise<RuntimeApplyRequest> {
    const req = await this.repo.findById(id, tenantId);
    if (!req) throw new RuntimeApplyNotFoundError(id);
    return req;
  }

  // Used by the Go agent poll endpoint.
  async listPendingForNode(nodeId: string): Promise<PendingApplyRequest[]> {
    return this.repo.listPendingForNode(nodeId);
  }

  // Go agent claims a pending request before execution.
  async claimForNode(id: string, nodeId: string): Promise<RuntimeApplyRequest> {
    const req = await this.repo.claim(id, nodeId);
    if (!req) throw new RuntimeApplyNotFoundError(id);
    return req;
  }

  // Go agent posts the result after executing the ESL command.
  async recordResult(
    id: string,
    nodeId: string,
    result: ApplyResultInput,
  ): Promise<RuntimeApplyRequest> {
    const req = await this.repo.applyResult(id, nodeId, result);
    if (!req) throw new RuntimeApplyNotFoundError(id);
    return req;
  }

  static isAllowedAction(action: string): action is RuntimeApplyActionType {
    return (RUNTIME_APPLY_ACTION_TYPES as readonly string[]).includes(action);
  }
}
