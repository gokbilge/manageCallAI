import type { IvrFlowRepository } from './ivr-flow.repository.js';
import type {
  CreateIvrFlowInput,
  FlowHistory,
  FlowVersion,
  FlowSimulationResult,
  FlowValidationResult,
  IvrFlow,
  IvrFlowWithVersions,
  PublishAttemptResult,
  SimulationOutcome,
  SimulationScenario,
  SimulationStep,
  UpdateIvrFlowInput,
} from './ivr-flow.types.js';
import { defaultIvrGraph, validateIvrGraph } from './ivr-flow.validation.js';
import { buildPlannerGraph, resolveNextNode } from './ivr-graph-planner.js';
import type { Role } from '../auth/capabilities.js';
import { isInBusinessHours } from '../schedules/schedule.util.js';

interface ScheduleRef {
  id: string;
  timezone: string;
  weekly_rules_json: unknown;
  holiday_overrides_json: unknown;
}

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

function toSimulationError(field: string, message: string) {
  return { field, message };
}

function getGraphNodes(graph: Record<string, unknown>): Array<Record<string, unknown>> {
  return Array.isArray(graph.nodes)
    ? (graph.nodes as Array<Record<string, unknown>>)
    : [];
}

function simulateGraph(
  graph: Record<string, unknown>,
  scenario: SimulationScenario,
  schedules: Map<string, ScheduleRef> = new Map(),
): SimulationOutcome {
  const baseValidation = validateIvrGraph(graph);
  if (baseValidation.status === 'failed') {
    return { status: 'failed', path: [], steps: [], final_action: null, errors: baseValidation.errors };
  }

  const planner = buildPlannerGraph(graph);
  if (!planner.entryNodeId) {
    return {
      status: 'failed',
      path: [],
      steps: [],
      final_action: null,
      errors: [toSimulationError('graph_json', 'Graph is missing a valid entry point or nodes array')],
    };
  }

  const path: string[] = [];
  const traceSteps: SimulationStep[] = [];
  let currentId: string | undefined = planner.entryNodeId;
  let guard = 0;
  let lastDigits = normalizeDigits(scenario);
  const variables: Record<string, string> = { ...(scenario.variables ?? {}) };
  const callerNumber = scenario.caller_number;
  const scenarioHour = resolveScenarioHour(scenario.now);
  let prevEdgeId: string | undefined;

  while (currentId && guard < 100) {
    guard += 1;
    path.push(currentId);
    const plannerNode = planner.nodes.get(currentId);
    if (!plannerNode) {
      return {
        status: 'failed',
        path,
        steps: traceSteps,
        final_action: null,
        errors: [toSimulationError(`graph_json.nodes.${currentId}`, 'Referenced node could not be loaded during simulation')],
      };
    }

    traceSteps.push({
      node_id: currentId,
      category: plannerNode.category ?? 'task',
      edge_id: prevEdgeId,
    });

    const type = plannerNode.type;

    // ── Terminal nodes (emit final_action and return) ────────────────────────
    if (type === 'transfer_extension') {
      return {
        status: 'passed',
        path,
        steps: traceSteps,
        final_action: {
          type: 'transfer_extension',
          extension_id: typeof plannerNode.raw.extension_id === 'string' ? plannerNode.raw.extension_id : undefined,
          extension_number: typeof plannerNode.raw.extension_number === 'string' ? plannerNode.raw.extension_number : undefined,
        },
        errors: [],
      };
    }
    if (type === 'queue') {
      return {
        status: 'passed',
        path,
        steps: traceSteps,
        final_action: { type: 'queue', queue_id: typeof plannerNode.raw.queue_id === 'string' ? plannerNode.raw.queue_id : undefined },
        errors: [],
      };
    }
    if (type === 'voicemail_drop') {
      return {
        status: 'passed',
        path,
        steps: traceSteps,
        final_action: { type: 'voicemail', voicemail_box_id: typeof plannerNode.raw.voicemail_box_id === 'string' ? plannerNode.raw.voicemail_box_id : undefined },
        errors: [],
      };
    }
    if (type === 'hangup') {
      return { status: 'passed', path, steps: traceSteps, final_action: { type: 'hangup' }, errors: [] };
    }

    // ── play_collect: determine outcome kind before calling planner ──────────
    let collectOutcome: { kind: 'timeout' | 'invalid' | 'digits'; digits?: string } | undefined;
    if (type === 'play_collect') {
      if (hasNodeFlag(currentId, scenario.force_timeout, scenario.force_timeout_nodes)) {
        collectOutcome = { kind: 'timeout' };
      } else {
        const collected = getCollectedDigitsForNode(currentId, scenario);
        if (hasNodeFlag(currentId, scenario.force_invalid, scenario.force_invalid_nodes) || !collected) {
          collectOutcome = { kind: 'invalid' };
        } else {
          lastDigits = collected;
          variables.last_digits = collected;
          variables[`node.${currentId}.digits`] = collected;
          collectOutcome = { kind: 'digits', digits: collected };
        }
      }
    }

    // ── business_hours: async schedule lookup; handled before planner call ───
    if (type === 'business_hours') {
      const scheduleId = typeof plannerNode.raw.schedule_id === 'string' ? plannerNode.raw.schedule_id : '';
      const schedule = schedules.get(scheduleId);
      if (!schedule) {
        return {
          status: 'failed',
          path,
          steps: traceSteps,
          final_action: null,
          errors: [toSimulationError(`graph_json.nodes.${currentId}.schedule_id`, `Schedule not found or not active: ${scheduleId}`)],
        };
      }
      const evalAt = scenario.now ? new Date(scenario.now) : new Date();
      const inHours = isInBusinessHours(
        {
          timezone: schedule.timezone,
          weekly_rules_json: Array.isArray(schedule.weekly_rules_json) ? schedule.weekly_rules_json as never : [],
          holiday_overrides_json: Array.isArray(schedule.holiday_overrides_json) ? schedule.holiday_overrides_json as never : [],
        },
        evalAt,
      );
      const ctx = { lastDigits, callerNumber, scenarioHour, variables, resolveBusinessHours: () => inHours };
      const { nextNodeId, edgeId } = resolveNextNode(plannerNode, ctx);
      prevEdgeId = edgeId;
      currentId = nextNodeId;
      continue;
    }

    // ── set_variable: mutate context before resolving next ───────────────────
    if (type === 'set_variable') {
      const variableName = typeof plannerNode.raw.variable_name === 'string' ? plannerNode.raw.variable_name : '';
      const value = typeof plannerNode.raw.value === 'string' ? plannerNode.raw.value : '';
      if (variableName) variables[variableName] = value;
    }

    const ctx = { lastDigits, callerNumber, scenarioHour, variables };
    const { nextNodeId, edgeId } = resolveNextNode(plannerNode, ctx, collectOutcome);

    if (nextNodeId === undefined && plannerNode.category !== 'end') {
      return {
        status: 'failed',
        path,
        steps: traceSteps,
        final_action: null,
        errors: [toSimulationError(`graph_json.nodes.${currentId}.type`, `Unsupported runtime node type: ${type}`)],
      };
    }

    prevEdgeId = edgeId;
    currentId = nextNodeId;
  }

  return {
    status: 'failed',
    path,
    steps: traceSteps,
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

  async getHistory(flowId: string, tenantId: string): Promise<FlowHistory> {
    const flow = await this.repo.findById(flowId, tenantId);
    if (!flow) throw new IvrFlowNotFoundError(flowId);
    return this.repo.getHistory(flowId, tenantId);
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
      const nodes = getGraphNodes(version.graph_json);
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

      const promptNodes = nodes.filter((n) =>
        (n.type === 'play_prompt' || n.type === 'play_collect') && typeof n.prompt_id === 'string');
      const promptIds = promptNodes.map((n) => n.prompt_id as string);
      const promptsById = await this.repo.findActivePromptRefs(tenantId, promptIds);
      for (const node of promptNodes) {
        const promptId = node.prompt_id as string;
        const prompt = promptsById.get(promptId);
        if (!prompt) {
          outcome.errors.push({
            field: `graph_json.nodes.${String(node.id)}.prompt_id`,
            message: `Prompt asset not found or not active in this tenant: ${promptId}`,
          });
          continue;
        }
        if (!prompt.storage_uri) {
          outcome.errors.push({
            field: `graph_json.nodes.${String(node.id)}.prompt_id`,
            message: `Prompt asset does not have a runtime storage_uri: ${promptId}`,
          });
        }
      }

      const businessHoursNodes = nodes.filter((n) => n.type === 'business_hours' && typeof n.schedule_id === 'string');
      const scheduleIds = businessHoursNodes.map((n) => n.schedule_id as string);
      const activeSchedules = await this.repo.findActiveScheduleRefs(tenantId, scheduleIds);
      for (const node of businessHoursNodes) {
        const sid = node.schedule_id as string;
        if (!activeSchedules.has(sid)) {
          outcome.errors.push({
            field: `graph_json.nodes.${String(node.id)}.schedule_id`,
            message: `Schedule not found or not active in this tenant: ${sid}`,
          });
        }
      }

      const callerIdPrefixPattern = /^\+?[0-9]{1,20}$/;
      const callerIdMatchNodes = nodes.filter((n) => n.type === 'caller_id_match' && Array.isArray(n.prefixes));
      for (const node of callerIdMatchNodes) {
        const prefixes = node.prefixes as unknown[];
        for (const prefix of prefixes) {
          if (typeof prefix !== 'string' || !callerIdPrefixPattern.test(prefix)) {
            outcome.errors.push({
              field: `graph_json.nodes.${String(node.id)}.prefixes`,
              message: `Invalid caller ID prefix format: "${String(prefix)}"`,
            });
          }
        }
      }

      const setVariableNodes = nodes.filter((n) => n.type === 'set_variable');
      for (const node of setVariableNodes) {
        if (typeof node.variable_name !== 'string' || node.variable_name.length === 0) {
          outcome.errors.push({
            field: `graph_json.nodes.${String(node.id)}.variable_name`,
            message: 'set_variable nodes require a variable_name',
          });
        }
        if (typeof node.value !== 'string') {
          outcome.errors.push({
            field: `graph_json.nodes.${String(node.id)}.value`,
            message: 'set_variable nodes require a string value',
          });
        }
      }

      const queueNodes = nodes.filter((n) => n.type === 'queue' && typeof n.queue_id === 'string');
      const queueIds = queueNodes.map((n) => n.queue_id as string);
      const queuesById = await this.repo.findActiveQueueRefs(tenantId, queueIds);
      for (const node of queueNodes) {
        const queueId = node.queue_id as string;
        const queue = queuesById.get(queueId);
        if (!queue) {
          outcome.errors.push({
            field: `graph_json.nodes.${String(node.id)}.queue_id`,
            message: `Queue not found or not active in this tenant: ${queueId}`,
          });
          continue;
        }
        if (queue.members.length === 0) {
          outcome.errors.push({
            field: `graph_json.nodes.${String(node.id)}.queue_id`,
            message: `Queue does not have any active members: ${queueId}`,
          });
        }
      }

      const voicemailNodes = nodes.filter((n) => n.type === 'voicemail_drop' && typeof n.voicemail_box_id === 'string');
      const voicemailIds = voicemailNodes.map((n) => n.voicemail_box_id as string);
      const voicemailById = await this.repo.findActiveVoicemailBoxRefs(tenantId, voicemailIds);
      for (const node of voicemailNodes) {
        const voicemailId = node.voicemail_box_id as string;
        if (!voicemailById.has(voicemailId)) {
          outcome.errors.push({
            field: `graph_json.nodes.${String(node.id)}.voicemail_box_id`,
            message: `Voicemail box not found or not active in this tenant: ${voicemailId}`,
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

    const nodes = getGraphNodes(version.graph_json);
    const scheduleIds = nodes
      .filter((n) => n.type === 'business_hours' && typeof n.schedule_id === 'string')
      .map((n) => n.schedule_id as string);
    const schedules = await this.repo.findActiveScheduleRefs(tenantId, scheduleIds);

    const outcome = simulateGraph(version.graph_json, scenario, schedules);
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

  async publish(flowId: string, versionId: string, tenantId: string, triggeredById: string, actorRole?: Role): Promise<PublishAttemptResult> {
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

  async rollback(flowId: string, tenantId: string, triggeredById: string, actorRole?: Role): Promise<PublishAttemptResult> {
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
