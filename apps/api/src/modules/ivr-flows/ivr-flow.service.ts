import type { IvrFlowRepository } from './ivr-flow.repository.js';
import type {
  CreateIvrFlowInput,
  FlowVersion,
  FlowSimulationResult,
  FlowValidationResult,
  IvrFlow,
  IvrFlowWithVersions,
  PublishAttemptResult,
  SimulationOutcome,
  SimulationScenario,
  UpdateIvrFlowInput,
} from './ivr-flow.types.js';
import { defaultIvrGraph, validateIvrGraph } from './ivr-flow.validation.js';

export class IvrFlowNotFoundError extends Error {
  constructor(id: string) { super(`IVR flow not found: ${id}`); this.name = 'IvrFlowNotFoundError'; }
}

export class FlowVersionNotFoundError extends Error {
  constructor(id: string) { super(`Flow version not found: ${id}`); this.name = 'FlowVersionNotFoundError'; }
}

export class FlowVersionStateError extends Error {
  constructor(msg: string) { super(msg); this.name = 'FlowVersionStateError'; }
}

export class RollbackNotAvailableError extends Error {
  constructor() { super('No superseded version available for rollback'); this.name = 'RollbackNotAvailableError'; }
}

function normalizeDigits(scenario: SimulationScenario): string | undefined {
  if (!scenario.digits || scenario.digits.length === 0) return undefined;
  return scenario.digits.join('');
}

function resolveScenarioHour(now: string | undefined): string | undefined {
  if (!now) return undefined;
  const match = now.match(/T(\d{2}):\d{2}/);
  return match?.[1];
}

function hasNodeFlag(nodeId: string, globalFlag: boolean | undefined, nodeIds: string[] | undefined): boolean {
  return globalFlag === true || nodeIds?.includes(nodeId) === true;
}

function getCollectedDigitsForNode(nodeId: string, scenario: SimulationScenario): string | undefined {
  const nodeDigits = scenario.collected_digits?.[nodeId];
  if (typeof nodeDigits === 'string' && nodeDigits.length > 0) {
    return nodeDigits;
  }
  return normalizeDigits(scenario);
}

function resolveSwitchInput(
  node: Record<string, unknown>,
  context: {
    lastDigits?: string;
    callerNumber?: string;
    scenarioHour?: string;
    variables: Record<string, string>;
  },
): string | undefined {
  const rawInput = typeof node.input === 'string' ? node.input : '{{last_digits}}';
  const tokenMatch = rawInput.match(/^\{\{(.+)\}\}$/);
  if (!tokenMatch) {
    return rawInput;
  }

  const token = tokenMatch[1]?.trim();
  if (!token) return undefined;
  if (token === 'last_digits') return context.lastDigits;
  if (token === 'caller_number') return context.callerNumber;
  if (token === 'now.hour') return context.scenarioHour;
  if (token.startsWith('var.')) return context.variables[token.slice(4)];
  return context.variables[token];
}

function toSimulationError(field: string, message: string) {
  return { field, message };
}

function simulateGraph(graph: Record<string, unknown>, scenario: SimulationScenario): SimulationOutcome {
  const baseValidation = validateIvrGraph(graph);
  if (baseValidation.status === 'failed') {
    return {
      status: 'failed',
      path: [],
      final_action: null,
      errors: baseValidation.errors,
    };
  }

  const entryNodeId = graph.entry_node_id;
  const nodesValue = graph.nodes;
  if (typeof entryNodeId !== 'string' || !Array.isArray(nodesValue)) {
    return {
      status: 'failed',
      path: [],
      final_action: null,
      errors: [toSimulationError('graph_json', 'Graph is missing a valid entry point or nodes array')],
    };
  }

  const nodes = new Map<string, Record<string, unknown>>();
  for (const node of nodesValue) {
    if (typeof node === 'object' && node !== null && !Array.isArray(node) && typeof (node as Record<string, unknown>).id === 'string') {
      nodes.set((node as Record<string, unknown>).id as string, node as Record<string, unknown>);
    }
  }

  const path: string[] = [];
  let currentId: string | undefined = entryNodeId;
  let steps = 0;
  let lastDigits = normalizeDigits(scenario);
  const variables: Record<string, string> = { ...(scenario.variables ?? {}) };
  const callerNumber = scenario.caller_number;
  const scenarioHour = resolveScenarioHour(scenario.now);

  while (currentId && steps < 100) {
    steps += 1;
    path.push(currentId);
    const node = nodes.get(currentId);
    if (!node) {
      return {
        status: 'failed',
        path,
        final_action: null,
        errors: [toSimulationError(`graph_json.nodes.${currentId}`, 'Referenced node could not be loaded during simulation')],
      };
    }

    const type = String(node.type ?? '');
    if (type === 'start') {
      currentId = typeof node.next_node_id === 'string' ? node.next_node_id : undefined;
      continue;
    }

    if (type === 'play' || type === 'play_prompt') {
      currentId = typeof node.next_node_id === 'string' ? node.next_node_id : undefined;
      continue;
    }

    if (type === 'menu' || type === 'play_collect') {
      if (hasNodeFlag(currentId, scenario.force_timeout, scenario.force_timeout_nodes)) {
        currentId = typeof node.timeout_node_id === 'string' ? node.timeout_node_id : undefined;
        continue;
      }
      const collectedDigits = getCollectedDigitsForNode(currentId, scenario);
      if (hasNodeFlag(currentId, scenario.force_invalid, scenario.force_invalid_nodes) || !collectedDigits) {
        currentId = typeof node.invalid_node_id === 'string'
          ? node.invalid_node_id
          : typeof node.default_node_id === 'string'
            ? node.default_node_id
            : undefined;
        continue;
      }
      lastDigits = collectedDigits;
      variables.last_digits = collectedDigits;
      variables[`node.${currentId}.digits`] = collectedDigits;
      currentId = typeof node.next_node_id === 'string' ? node.next_node_id : undefined;
      continue;
    }

    if (type === 'switch' || type === 'condition') {
      const cases = node.cases;
      const lookup = typeof cases === 'object' && cases !== null && !Array.isArray(cases)
        ? (cases as Record<string, unknown>)
        : {};
      const resolvedInput = resolveSwitchInput(node, { lastDigits, callerNumber, scenarioHour, variables });
      const selected = resolvedInput ? lookup[resolvedInput] : undefined;
      currentId = typeof selected === 'string'
        ? selected
        : typeof node.default_node_id === 'string'
          ? node.default_node_id
          : undefined;
      continue;
    }

    if (type === 'transfer_extension' || type === 'transfer') {
      return {
        status: 'passed',
        path,
        final_action: {
          type: 'transfer_extension',
          extension_id: typeof node.extension_id === 'string' ? node.extension_id : undefined,
          extension_number: typeof node.extension_number === 'string' ? node.extension_number : undefined,
        },
        errors: [],
      };
    }

    if (type === 'hangup') {
      return {
        status: 'passed',
        path,
        final_action: { type: 'hangup' },
        errors: [],
      };
    }

    return {
      status: 'failed',
      path,
      final_action: null,
      errors: [toSimulationError(`graph_json.nodes.${currentId}.type`, `Unsupported runtime node type: ${type}`)],
    };
  }

  return {
    status: 'failed',
    path,
    final_action: null,
    errors: [toSimulationError('graph_json', 'Simulation exceeded maximum traversal steps or hit an unresolved dead end')],
  };
}

export class IvrFlowService {
  constructor(private readonly repo: IvrFlowRepository) {}

  listByTenant(tenantId: string): Promise<IvrFlow[]> {
    return this.repo.findAllByTenant(tenantId);
  }

  async getById(id: string, tenantId: string): Promise<IvrFlowWithVersions> {
    const flow = await this.repo.findById(id, tenantId);
    if (!flow) throw new IvrFlowNotFoundError(id);
    return flow;
  }

  create(input: CreateIvrFlowInput): Promise<IvrFlowWithVersions> {
    return this.repo.create(input);
  }

  async update(id: string, tenantId: string, input: UpdateIvrFlowInput): Promise<IvrFlow> {
    const flow = await this.repo.update(id, tenantId, input);
    if (!flow) throw new IvrFlowNotFoundError(id);
    return flow;
  }

  async listVersions(flowId: string, tenantId: string): Promise<FlowVersion[]> {
    const flow = await this.repo.findById(flowId, tenantId);
    if (!flow) throw new IvrFlowNotFoundError(flowId);
    return this.repo.findVersionsByFlowId(flowId, tenantId);
  }

  async getVersion(flowId: string, versionId: string, tenantId: string): Promise<FlowVersion> {
    const version = await this.repo.findVersionById(versionId, flowId, tenantId);
    if (!version) throw new FlowVersionNotFoundError(versionId);
    return version;
  }

  async createVersion(flowId: string, tenantId: string, graphJson: Record<string, unknown> | undefined, createdBy?: string): Promise<FlowVersion> {
    const flow = await this.repo.findById(flowId, tenantId);
    if (!flow) throw new IvrFlowNotFoundError(flowId);
    const nextNum = await this.repo.nextVersionNumber(flowId);
    const sourceGraph = graphJson ?? flow.versions[0]?.graph_json ?? defaultIvrGraph();
    return this.repo.createVersion({ tenant_id: tenantId, flow_id: flowId, version_number: nextNum, definition: sourceGraph, created_by: createdBy });
  }

  async updateVersionDefinition(flowId: string, versionId: string, tenantId: string, graphJson: Record<string, unknown>): Promise<FlowVersion> {
    const version = await this.repo.updateVersionDefinition(versionId, flowId, tenantId, graphJson);
    if (!version) throw new FlowVersionNotFoundError(versionId);
    return version;
  }

  async validate(flowId: string, versionId: string, tenantId: string): Promise<FlowValidationResult> {
    const version = await this.repo.findVersionById(versionId, flowId, tenantId);
    if (!version) throw new FlowVersionNotFoundError(versionId);

    const outcome = validateIvrGraph(version.graph_json);

    // Semantic check: transfer_extension nodes must reference active extensions
    // in the same tenant. Only runs when the graph is structurally valid.
    if (outcome.status === 'passed') {
      const nodes = Array.isArray((version.graph_json as Record<string, unknown>).nodes)
        ? ((version.graph_json as Record<string, unknown>).nodes as Array<Record<string, unknown>>)
        : [];
      const transferNodes = nodes.filter((n) => n.type === 'transfer_extension' && typeof n.extension_id === 'string');
      const extensionIds = transferNodes.map((n) => n.extension_id as string);
      const activeIds = await this.repo.findActiveExtensionIds(tenantId, extensionIds);
      for (const node of transferNodes) {
        const eid = node.extension_id as string;
        if (!activeIds.has(eid)) {
          outcome.errors.push({
            field: `graph_json.nodes.${String(node.id)}.extension_id`,
            message: `Extension not found or not active in this tenant: ${eid}`,
          });
        }
      }
      if (outcome.errors.length > 0) {
        outcome.status = 'failed';
      }
    }

    await this.repo.storeValidationResult({ tenant_id: tenantId, flow_id: flowId, version_id: versionId, outcome });

    if (outcome.status === 'passed') {
      const updated = await this.repo.markVersionValidated(versionId, flowId, tenantId);
      return { version: updated ?? version, outcome };
    }

    return { version, outcome };
  }

  async validateCurrentDraft(flowId: string, tenantId: string): Promise<FlowValidationResult> {
    const flow = await this.repo.findById(flowId, tenantId);
    if (!flow) throw new IvrFlowNotFoundError(flowId);
    const versionId = flow.draft_version_id ?? flow.versions.find((version) => version.state === 'draft')?.id;
    if (!versionId) {
      throw new FlowVersionStateError('No draft version available to validate');
    }
    return this.validate(flowId, versionId, tenantId);
  }

  async simulate(flowId: string, versionId: string, tenantId: string, scenario: SimulationScenario): Promise<FlowSimulationResult> {
    const version = await this.repo.findVersionById(versionId, flowId, tenantId);
    if (!version) throw new FlowVersionNotFoundError(versionId);

    const outcome = simulateGraph(version.graph_json, scenario);
    await this.repo.storeSimulationResult({ tenant_id: tenantId, flow_id: flowId, version_id: versionId, scenario, outcome });

    if (outcome.status === 'passed') {
      const updated = await this.repo.markVersionSimulated(versionId, flowId, tenantId);
      return { version: updated ?? version, scenario, outcome };
    }

    return { version, scenario, outcome };
  }

  async simulateCurrentDraft(flowId: string, tenantId: string, scenario: SimulationScenario): Promise<FlowSimulationResult> {
    const flow = await this.repo.findById(flowId, tenantId);
    if (!flow) throw new IvrFlowNotFoundError(flowId);
    const versionId = flow.draft_version_id ?? flow.versions.find((version) => version.state === 'draft' || version.state === 'validated' || version.state === 'simulated')?.id;
    if (!versionId) {
      throw new FlowVersionStateError('No draft version available to simulate');
    }
    return this.simulate(flowId, versionId, tenantId, scenario);
  }

  async publish(flowId: string, versionId: string, tenantId: string, triggeredById: string, actorRole?: 'platform_admin' | 'tenant_admin'): Promise<PublishAttemptResult> {
    const version = await this.repo.findVersionById(versionId, flowId, tenantId);
    if (!version) throw new FlowVersionNotFoundError(versionId);
    if (!['validated', 'simulated'].includes(version.state)) {
      throw new FlowVersionStateError(`Version must be in 'validated' or 'simulated' state to publish; current state: ${version.state}`);
    }

    const policy = await this.repo.getActivePublishPolicy(tenantId);
    if (policy?.require_approval && actorRole !== 'platform_admin') {
      const approvalRequest = await this.repo.createApprovalRequest({
        tenant_id: tenantId,
        flow_id: flowId,
        version_id: versionId,
        requested_by: triggeredById,
      });
      await this.repo.storePendingPublishRecord({
        tenant_id: tenantId,
        flow_id: flowId,
        version_id: versionId,
        triggered_by_id: triggeredById,
        approval_request_id: approvalRequest.id,
        action_type: 'publish',
      });
      const flow = await this.getById(flowId, tenantId);
      return { status: 'pending_approval', flow, approval_request_id: approvalRequest.id };
    }

    const flow = await this.repo.publish({ tenant_id: tenantId, flow_id: flowId, version_id: versionId, triggered_by_id: triggeredById });
    return { status: 'published', flow };
  }

  async rollback(flowId: string, tenantId: string, triggeredById: string, actorRole?: 'platform_admin' | 'tenant_admin'): Promise<PublishAttemptResult> {
    const flow = await this.repo.findById(flowId, tenantId);
    if (!flow) throw new IvrFlowNotFoundError(flowId);
    const rollbackTargetId = flow.versions.find((version) => version.state === 'superseded')?.id;
    if (!rollbackTargetId) {
      throw new RollbackNotAvailableError();
    }

    const policy = await this.repo.getActivePublishPolicy(tenantId);
    if (policy?.require_approval && actorRole !== 'platform_admin') {
      const approvalRequest = await this.repo.createApprovalRequest({
        tenant_id: tenantId,
        flow_id: flowId,
        version_id: rollbackTargetId,
        requested_by: triggeredById,
      });
      await this.repo.storePendingPublishRecord({
        tenant_id: tenantId,
        flow_id: flowId,
        version_id: rollbackTargetId,
        triggered_by_id: triggeredById,
        approval_request_id: approvalRequest.id,
        action_type: 'rollback',
      });
      return { status: 'pending_approval', flow, approval_request_id: approvalRequest.id };
    }

    const result = await this.repo.rollback({ tenant_id: tenantId, flow_id: flowId, triggered_by_id: triggeredById });
    if (!result) throw new RollbackNotAvailableError();
    return { status: 'published', flow: result.flow };
  }
}
