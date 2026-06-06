import type {
  ExtensionTransferReference,
  PromptAssetReference,
  QueueTransferReference,
  VoicemailBoxReference,
} from '../ivr-flows/ivr-flow.types.js';
import { buildPlannerGraph, resolveSwitchInput } from '../ivr-flows/ivr-graph-planner.js';
import { isInBusinessHours } from '../schedules/schedule.util.js';
import type { IvrRuntimeRepository } from './ivr-runtime.repository.js';
import type {
  AdvanceIvrRuntimeSessionInput,
  IvrRuntimeAction,
  IvrRuntimeSessionReplay,
  IvrRuntimeSession,
  IvrRuntimeSessionResult,
  StartIvrRuntimeSessionInput,
} from './ivr-runtime.types.js';

type GraphNode = Record<string, unknown> & { id: string; type: string };

export class IvrRuntimeFlowNotPublishedError extends Error {
  constructor(flowId: string) {
    super(`IVR flow is not active and published: ${flowId}`);
    this.name = 'IvrRuntimeFlowNotPublishedError';
  }
}

export class IvrRuntimeSessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`IVR runtime session not found: ${sessionId}`);
    this.name = 'IvrRuntimeSessionNotFoundError';
  }
}

export class IvrRuntimeSessionStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IvrRuntimeSessionStateError';
  }
}

export class IvrRuntimeResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IvrRuntimeResolutionError';
  }
}

function isGraphNode(value: unknown): value is GraphNode {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && typeof (value as Record<string, unknown>).id === 'string'
    && typeof (value as Record<string, unknown>).type === 'string';
}

export class IvrRuntimeService {
  constructor(private readonly repo: IvrRuntimeRepository) {}

  listSessions(tenantId: string, status?: IvrRuntimeSession['status']): Promise<IvrRuntimeSession[]> {
    return this.repo.listSessionsByTenant(tenantId, status);
  }

  async getSessionReplay(sessionId: string, tenantId: string): Promise<IvrRuntimeSessionReplay> {
    const session = await this.repo.findSessionByIdForTenant(sessionId, tenantId);
    if (!session) {
      throw new IvrRuntimeSessionNotFoundError(sessionId);
    }

    const [steps, callEvents] = await Promise.all([
      this.repo.listSessionSteps(session.id, tenantId),
      this.repo.listCallEventsByCallId(session.call_id, tenantId),
    ]);

    return {
      session,
      steps,
      call_events: callEvents,
    };
  }

  async startSession(input: StartIvrRuntimeSessionInput): Promise<IvrRuntimeSessionResult> {
    const active = await this.repo.findActiveFlowVersion(input.flow_id);
    if (!active) {
      throw new IvrRuntimeFlowNotPublishedError(input.flow_id);
    }

    const resolved = await this.resolveNextAction({
      tenant_id: active.tenant_id,
      graph_json: active.graph_json,
      current_node_id: null,
      entry_node_id_override: undefined,
      caller_number: input.caller_number ?? null,
      last_digits: null,
      variables: { ...(input.variables ?? {}) },
      transition: { kind: 'start' },
    });

    const session = await this.repo.createSession({
      tenant_id: active.tenant_id,
      flow_id: active.flow_id,
      flow_version_id: active.flow_version_id,
      call_id: input.call_id,
      caller_number: input.caller_number,
      destination_number: input.destination_number,
      variables_json: resolved.variables,
      current_node_id: resolved.current_node_id,
      last_digits: resolved.last_digits,
      last_action_json: resolved.action ? { ...resolved.action } : null,
    });

    if (!resolved.action) {
      const completed = await this.repo.updateSessionState({
        id: session.id,
        status: 'completed',
        current_node_id: null,
        last_digits: resolved.last_digits,
        variables_json: resolved.variables,
        last_action_json: null,
        completed_at: new Date(),
      });
      await this.repo.recordSessionStep({
        tenant_id: completed.tenant_id,
        session_id: completed.id,
        phase: 'start',
        node_id: null,
        outcome: 'start',
        action_json: null,
        resulting_node_id: null,
        resulting_status: completed.status,
        variables_json: resolved.variables,
      });
      return { session: completed, action: null };
    }

    await this.repo.recordSessionStep({
      tenant_id: session.tenant_id,
      session_id: session.id,
      phase: 'start',
      node_id: null,
      outcome: 'start',
      action_json: { ...resolved.action },
      resulting_node_id: session.current_node_id,
      resulting_status: session.status,
      variables_json: resolved.variables,
    });

    return { session, action: resolved.action };
  }

  async advanceSession(sessionId: string, input: AdvanceIvrRuntimeSessionInput): Promise<IvrRuntimeSessionResult> {
    const session = await this.repo.findSessionById(sessionId);
    if (!session) {
      throw new IvrRuntimeSessionNotFoundError(sessionId);
    }
    if (session.status !== 'running') {
      throw new IvrRuntimeSessionStateError(`Session is not running: ${session.status}`);
    }
    if (!session.current_node_id || session.current_node_id !== input.node_id) {
      throw new IvrRuntimeSessionStateError('Action result does not match the current runtime node');
    }

    const flow = await this.repo.getFlowGraphForSession(sessionId);
    if (!flow) {
      throw new IvrRuntimeSessionStateError('Pinned flow version could not be loaded for this runtime session');
    }

    const variables = { ...(session.variables_json ?? {}), ...(input.variables ?? {}) };
    const resolved = await this.resolveNextAction({
      tenant_id: session.tenant_id,
      graph_json: flow.graph_json,
      current_node_id: session.current_node_id,
      entry_node_id_override: undefined,
      caller_number: session.caller_number,
      last_digits: session.last_digits,
      variables,
      transition: input,
    });

    const updated = await this.repo.updateSessionState({
      id: session.id,
      status: resolved.action ? 'running' : 'completed',
      current_node_id: resolved.current_node_id,
      last_digits: resolved.last_digits,
      variables_json: resolved.variables,
      last_action_json: resolved.action ? { ...resolved.action } : null,
      completed_at: resolved.action ? null : new Date(),
    });

    await this.repo.recordSessionStep({
      tenant_id: updated.tenant_id,
      session_id: updated.id,
      phase: 'advance',
      node_id: input.node_id,
      outcome: input.outcome,
      digits: input.digits ?? null,
      action_json: resolved.action ? { ...resolved.action } : null,
      resulting_node_id: updated.current_node_id,
      resulting_status: updated.status,
      variables_json: resolved.variables,
    });

    return { session: updated, action: resolved.action };
  }

  private async resolveNextAction(input: {
    tenant_id: string;
    graph_json: Record<string, unknown>;
    current_node_id: string | null;
    entry_node_id_override?: string;
    caller_number: string | null;
    last_digits: string | null;
    variables: Record<string, string>;
    transition:
      | { kind: 'start' }
      | AdvanceIvrRuntimeSessionInput;
  }): Promise<{
    action: IvrRuntimeAction | null;
    current_node_id: string | null;
    last_digits: string | null;
    variables: Record<string, string>;
  }> {
    const planner = buildPlannerGraph(input.graph_json);
    const entryNodeId = planner.entryNodeId;
    // Build a GraphNode map from planner raw nodes for backward-compatible access.
    const nodes = new Map<string, GraphNode>();
    for (const [id, pNode] of planner.nodes) {
      if (isGraphNode(pNode.raw)) nodes.set(id, pNode.raw);
    }
    let nextNodeId = input.entry_node_id_override ?? entryNodeId;
    let lastDigits = input.last_digits;
    const variables = { ...input.variables };
    const isStartTransition = 'kind' in input.transition && input.transition.kind === 'start';

    if (!isStartTransition) {
      const transition = input.transition as AdvanceIvrRuntimeSessionInput;
      const currentNode = nodes.get(input.current_node_id ?? '');
      if (!currentNode) {
        throw new IvrRuntimeResolutionError(`Current runtime node could not be loaded: ${input.current_node_id}`);
      }

      const currentType = String(currentNode.type);
      if (currentType === 'play_prompt') {
        nextNodeId = typeof currentNode.next_node_id === 'string' ? currentNode.next_node_id : '';
      } else if (currentType === 'play_collect') {
        const outcome = transition.outcome;
        if (outcome === 'timeout') {
          nextNodeId = typeof currentNode.timeout_node_id === 'string'
            ? currentNode.timeout_node_id
            : typeof currentNode.default_node_id === 'string'
              ? currentNode.default_node_id
              : '';
        } else if (outcome === 'invalid') {
          nextNodeId = typeof currentNode.invalid_node_id === 'string'
            ? currentNode.invalid_node_id
            : typeof currentNode.default_node_id === 'string'
              ? currentNode.default_node_id
              : '';
        } else {
          const digits = transition.digits?.trim();
          if (!digits) {
            throw new IvrRuntimeSessionStateError('play_collect completion requires digits or an explicit timeout/invalid outcome');
          }
          lastDigits = digits;
          variables.last_digits = digits;
          variables[`node.${currentNode.id}.digits`] = digits;
          nextNodeId = typeof currentNode.next_node_id === 'string' ? currentNode.next_node_id : '';
        }
      } else if (
        currentType === 'transfer_extension'
        || currentType === 'queue'
        || currentType === 'voicemail_drop'
        || currentType === 'hangup'
      ) {
        return {
          action: null,
          current_node_id: null,
          last_digits: lastDigits,
          variables,
        };
      } else {
        throw new IvrRuntimeResolutionError(`Unsupported runtime completion node type: ${currentType}`);
      }
    }

    let guard = 0;
    while (nextNodeId && guard < 100) {
      guard += 1;
      const node = nodes.get(nextNodeId);
      if (!node) {
        throw new IvrRuntimeResolutionError(`Referenced runtime node does not exist: ${nextNodeId}`);
      }

      const type = String(node.type);
      if (type === 'start') {
        nextNodeId = typeof node.next_node_id === 'string' ? node.next_node_id : '';
        continue;
      }

      if (type === 'switch') {
        const cases = typeof node.cases === 'object' && node.cases !== null && !Array.isArray(node.cases)
          ? (node.cases as Record<string, unknown>)
          : {};
        const currentHour = new Date().getHours().toString().padStart(2, '0');
        const plannerNodeForSwitch = planner.nodes.get(nextNodeId) ?? { id: node.id, type: node.type, category: undefined as never, raw: node };
        const selectedInput = resolveSwitchInput(plannerNodeForSwitch, {
          lastDigits,
          callerNumber: input.caller_number,
          scenarioHour: currentHour,
          variables,
        });
        const selectedNodeId = selectedInput ? cases[selectedInput] : undefined;
        nextNodeId = typeof selectedNodeId === 'string'
          ? selectedNodeId
          : typeof node.default_node_id === 'string'
            ? node.default_node_id
            : '';
        continue;
      }

      if (type === 'set_variable') {
        const variableName = typeof node.variable_name === 'string' ? node.variable_name : '';
        const value = typeof node.value === 'string' ? node.value : '';
        if (variableName) {
          variables[variableName] = value;
        }
        nextNodeId = typeof node.next_node_id === 'string' ? node.next_node_id : '';
        continue;
      }

      if (type === 'play_prompt') {
        const prompt = await this.requirePrompt(input.tenant_id, node);
        return {
          action: {
            action: 'play_prompt',
            node_id: node.id,
            prompt_id: prompt.id,
            prompt_uri: prompt.storage_uri!,
          },
          current_node_id: node.id,
          last_digits: lastDigits,
          variables,
        };
      }

      if (type === 'play_collect') {
        const prompt = await this.requirePrompt(input.tenant_id, node);
        return {
          action: {
            action: 'play_collect',
            node_id: node.id,
            prompt_id: prompt.id,
            prompt_uri: prompt.storage_uri!,
            max_digits: typeof node.max_digits === 'number' ? node.max_digits : 1,
            timeout_ms: typeof node.timeout_ms === 'number' ? node.timeout_ms : 5000,
            retries: typeof node.retries === 'number' ? node.retries : 0,
          },
          current_node_id: node.id,
          last_digits: lastDigits,
          variables,
        };
      }

      if (type === 'transfer_extension') {
        const target = await this.requireExtensionTarget(input.tenant_id, node);
        return {
          action: {
            action: 'transfer',
            node_id: node.id,
            target_type: 'extension',
            target: target.extension_number,
            domain: target.directory_domain,
          },
          current_node_id: node.id,
          last_digits: lastDigits,
          variables,
        };
      }

      if (type === 'queue') {
        const target = await this.requireQueueTarget(input.tenant_id, node);
        return {
          action: {
            action: 'transfer',
            node_id: node.id,
            target_type: 'queue',
            strategy: target.strategy,
            ring_timeout_seconds: target.ring_timeout_seconds,
            retry_delay_seconds: target.retry_delay_seconds,
            max_wait_seconds: target.max_wait_seconds,
            music_on_hold: target.music_on_hold,
            overflow_target_type: target.overflow_target_type,
            overflow_target_id: target.overflow_target_id,
            members: target.members.map((member) => ({
              extension_number: member.extension_number,
              domain: member.directory_domain,
            })),
          },
          current_node_id: node.id,
          last_digits: lastDigits,
          variables,
        };
      }

      if (type === 'voicemail_drop') {
        const target = await this.requireVoicemailTarget(input.tenant_id, node);
        return {
          action: {
            action: 'voicemail',
            node_id: node.id,
            mailbox_number: target.mailbox_number,
            domain: target.directory_domain,
            greeting_prompt_uri: target.greeting_prompt_uri,
          },
          current_node_id: node.id,
          last_digits: lastDigits,
          variables,
        };
      }

      if (type === 'hangup') {
        return {
          action: {
            action: 'hangup',
            node_id: node.id,
          },
          current_node_id: node.id,
          last_digits: lastDigits,
          variables,
        };
      }

      if (type === 'caller_id_match') {
        const prefixes = Array.isArray(node.prefixes) ? (node.prefixes as string[]) : [];
        const callerNum = input.caller_number ?? '';
        const matched = prefixes.some((p) => typeof p === 'string' && callerNum.startsWith(p));
        nextNodeId = typeof (matched ? node.match_node_id : node.no_match_node_id) === 'string'
          ? (matched ? node.match_node_id : node.no_match_node_id) as string
          : '';
        continue;
      }

      if (type === 'business_hours') {
        const scheduleId = typeof node.schedule_id === 'string' ? node.schedule_id : '';
        if (!scheduleId) {
          throw new IvrRuntimeResolutionError(`business_hours node is missing schedule_id: ${node.id}`);
        }
        const schedule = await this.repo.findActiveSchedule(input.tenant_id, scheduleId);
        if (!schedule) {
          throw new IvrRuntimeResolutionError(`Schedule not found or inactive for business_hours node: ${scheduleId}`);
        }
        const inHours = isInBusinessHours(
          {
            timezone: schedule.timezone,
            weekly_rules_json: Array.isArray(schedule.weekly_rules_json) ? schedule.weekly_rules_json as never : [],
            holiday_overrides_json: Array.isArray(schedule.holiday_overrides_json) ? schedule.holiday_overrides_json as never : [],
            holiday_calendars: Array.isArray(schedule.holiday_calendars) ? schedule.holiday_calendars as never : [],
            temporary_overrides: Array.isArray(schedule.temporary_overrides) ? schedule.temporary_overrides as never : [],
          },
          new Date(),
        );
        nextNodeId = typeof (inHours ? node.in_hours_node_id : node.out_of_hours_node_id) === 'string'
          ? (inHours ? node.in_hours_node_id : node.out_of_hours_node_id) as string
          : '';
        continue;
      }

      throw new IvrRuntimeResolutionError(`Unsupported runtime node type: ${type}`);
    }

    if (guard >= 100) {
      throw new IvrRuntimeResolutionError('Runtime traversal exceeded the maximum step count');
    }

    return {
      action: null,
      current_node_id: null,
      last_digits: lastDigits,
      variables,
    };
  }

  private async requirePrompt(tenantId: string, node: GraphNode): Promise<PromptAssetReference> {
    const promptId = typeof node.prompt_id === 'string' ? node.prompt_id : '';
    if (!promptId) {
      throw new IvrRuntimeResolutionError(`Prompt node is missing prompt_id: ${node.id}`);
    }
    const prompts = await this.repo.findActivePromptRefs(tenantId, [promptId]);
    const prompt = prompts.get(promptId);
    if (!prompt || !prompt.storage_uri) {
      throw new IvrRuntimeResolutionError(`Prompt asset is not active or lacks storage_uri: ${promptId}`);
    }
    return prompt;
  }

  private async requireExtensionTarget(tenantId: string, node: GraphNode): Promise<ExtensionTransferReference> {
    const extensionId = typeof node.extension_id === 'string' ? node.extension_id : '';
    if (!extensionId) {
      throw new IvrRuntimeResolutionError(`Transfer node is missing extension_id: ${node.id}`);
    }
    const targets = await this.repo.findActiveExtensionTargets(tenantId, [extensionId]);
    const target = targets.get(extensionId);
    if (!target) {
      throw new IvrRuntimeResolutionError(`Extension target is not active in this tenant: ${extensionId}`);
    }
    return target;
  }

  private async requireQueueTarget(tenantId: string, node: GraphNode): Promise<QueueTransferReference> {
    const queueId = typeof node.queue_id === 'string' ? node.queue_id : '';
    if (!queueId) {
      throw new IvrRuntimeResolutionError(`Queue node is missing queue_id: ${node.id}`);
    }
    const targets = await this.repo.findActiveQueueTargets(tenantId, [queueId]);
    const target = targets.get(queueId);
    if (!target || target.members.length === 0) {
      throw new IvrRuntimeResolutionError(`Queue target is not active or has no members: ${queueId}`);
    }
    return target;
  }

  private async requireVoicemailTarget(tenantId: string, node: GraphNode): Promise<VoicemailBoxReference> {
    const boxId = typeof node.voicemail_box_id === 'string' ? node.voicemail_box_id : '';
    if (!boxId) {
      throw new IvrRuntimeResolutionError(`Voicemail node is missing voicemail_box_id: ${node.id}`);
    }
    const targets = await this.repo.findActiveVoicemailTargets(tenantId, [boxId]);
    const target = targets.get(boxId);
    if (!target) {
      throw new IvrRuntimeResolutionError(`Voicemail target is not active in this tenant: ${boxId}`);
    }
    return target;
  }
}
