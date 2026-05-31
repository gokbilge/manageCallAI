import type { IvrNodeCategory } from '@managecallai/contracts';
import { getNodeCategory } from './ivr-flow.validation.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlannerNode {
  id: string;
  type: string;
  category: IvrNodeCategory | undefined;
  raw: Record<string, unknown>;
}

export interface PlannerGraph {
  entryNodeId: string;
  nodes: ReadonlyMap<string, PlannerNode>;
}

export interface PlannerContext {
  lastDigits: string | null | undefined;
  callerNumber: string | null | undefined;
  scenarioHour: string | undefined;
  variables: Readonly<Record<string, string>>;
  // Optional: provide schedule lookup for business_hours nodes.
  // Return true if currently in hours, false if out of hours, undefined if unknown.
  resolveBusinessHours?: (scheduleId: string) => boolean | undefined;
}

export interface PlannerStepResult {
  nextNodeId: string | undefined;
  // Edge ID matching graphToBuilderEdges() format: "${source}:${handle}:${target}"
  edgeId: string | undefined;
  branchLabel: string | undefined;
}

// ── Graph builder ─────────────────────────────────────────────────────────────

export function buildPlannerGraph(graphJson: Record<string, unknown>): PlannerGraph {
  const entryNodeId = typeof graphJson.entry_node_id === 'string' ? graphJson.entry_node_id : '';
  const rawNodes = Array.isArray(graphJson.nodes) ? graphJson.nodes : [];
  const nodes = new Map<string, PlannerNode>();

  for (const rawNode of rawNodes) {
    if (typeof rawNode !== 'object' || rawNode === null || Array.isArray(rawNode)) continue;
    const node = rawNode as Record<string, unknown>;
    if (typeof node.id !== 'string' || typeof node.type !== 'string') continue;
    nodes.set(node.id, {
      id: node.id,
      type: node.type,
      category: getNodeCategory(node.type),
      raw: node,
    });
  }

  return { entryNodeId, nodes };
}

// ── Shared switch input resolver ──────────────────────────────────────────────
// Shared across simulation and runtime services. Resolves {{token}} expressions.

export function resolveSwitchInput(node: PlannerNode, ctx: PlannerContext): string | undefined {
  const rawInput = typeof node.raw.input === 'string' ? node.raw.input : '{{last_digits}}';
  const tokenMatch = rawInput.match(/^\{\{(.+)\}\}$/);
  if (!tokenMatch) return rawInput;
  const token = tokenMatch[1]?.trim();
  if (!token) return undefined;
  if (token === 'last_digits') return ctx.lastDigits ?? undefined;
  if (token === 'caller_number') return ctx.callerNumber ?? undefined;
  if (token === 'now.hour') return ctx.scenarioHour;
  if (token.startsWith('var.')) return ctx.variables[token.slice(4)];
  return ctx.variables[token];
}

// ── Step resolver ─────────────────────────────────────────────────────────────
// Resolves the next node and edge taken from the current node given execution context.
// Returns undefined nextNodeId for terminal nodes or when a branch cannot be resolved.
// Edge IDs match graphToBuilderEdges() format so the React builder can highlight them.

export function resolveNextNode(
  node: PlannerNode,
  ctx: PlannerContext,
  outcome?: { kind: 'timeout' | 'invalid' | 'digits'; digits?: string },
): PlannerStepResult {
  const raw = node.raw;
  const type = node.type;

  if (type === 'start' || type === 'play_prompt' || type === 'set_variable') {
    const nextId = typeof raw.next_node_id === 'string' ? raw.next_node_id : undefined;
    return {
      nextNodeId: nextId,
      edgeId: nextId ? `${node.id}:next:${nextId}` : undefined,
      branchLabel: 'next',
    };
  }

  if (type === 'play_collect') {
    if (outcome?.kind === 'timeout') {
      const nextId = typeof raw.timeout_node_id === 'string' ? raw.timeout_node_id : undefined;
      return {
        nextNodeId: nextId,
        edgeId: nextId ? `${node.id}:timeout:${nextId}` : undefined,
        branchLabel: 'timeout',
      };
    }
    if (outcome?.kind === 'invalid' || !outcome?.digits) {
      const hasInvalid = typeof raw.invalid_node_id === 'string';
      const nextId = hasInvalid
        ? (raw.invalid_node_id as string)
        : typeof raw.default_node_id === 'string' ? (raw.default_node_id as string) : undefined;
      const handle = hasInvalid ? 'invalid' : 'default';
      return {
        nextNodeId: nextId,
        edgeId: nextId ? `${node.id}:${handle}:${nextId}` : undefined,
        branchLabel: handle,
      };
    }
    const nextId = typeof raw.next_node_id === 'string' ? raw.next_node_id : undefined;
    return {
      nextNodeId: nextId,
      edgeId: nextId ? `${node.id}:next:${nextId}` : undefined,
      branchLabel: 'digits',
    };
  }

  if (type === 'switch') {
    const cases = typeof raw.cases === 'object' && raw.cases !== null && !Array.isArray(raw.cases)
      ? (raw.cases as Record<string, unknown>)
      : {};
    const input = resolveSwitchInput(node, ctx);
    const selected = input ? cases[input] : undefined;
    if (typeof selected === 'string') {
      return {
        nextNodeId: selected,
        edgeId: `${node.id}:case:${input!}:${selected}`,
        branchLabel: `case:${input!}`,
      };
    }
    const defaultId = typeof raw.default_node_id === 'string' ? (raw.default_node_id as string) : undefined;
    return {
      nextNodeId: defaultId,
      edgeId: defaultId ? `${node.id}:default:${defaultId}` : undefined,
      branchLabel: 'default',
    };
  }

  if (type === 'business_hours') {
    const scheduleId = typeof raw.schedule_id === 'string' ? raw.schedule_id : '';
    const inHours = ctx.resolveBusinessHours ? ctx.resolveBusinessHours(scheduleId) : undefined;
    if (inHours === undefined) {
      return { nextNodeId: undefined, edgeId: undefined, branchLabel: undefined };
    }
    const nextId = inHours
      ? (typeof raw.in_hours_node_id === 'string' ? (raw.in_hours_node_id as string) : undefined)
      : (typeof raw.out_of_hours_node_id === 'string' ? (raw.out_of_hours_node_id as string) : undefined);
    const handle = inHours ? 'in_hours' : 'out_of_hours';
    return {
      nextNodeId: nextId,
      edgeId: nextId ? `${node.id}:${handle}:${nextId}` : undefined,
      branchLabel: handle,
    };
  }

  if (type === 'caller_id_match') {
    const prefixes = Array.isArray(raw.prefixes) ? (raw.prefixes as string[]) : [];
    const callerNum = ctx.callerNumber ?? '';
    const matched = prefixes.some((p) => typeof p === 'string' && callerNum.startsWith(p));
    const nextId = matched
      ? (typeof raw.match_node_id === 'string' ? (raw.match_node_id as string) : undefined)
      : (typeof raw.no_match_node_id === 'string' ? (raw.no_match_node_id as string) : undefined);
    const handle = matched ? 'match' : 'no_match';
    return {
      nextNodeId: nextId,
      edgeId: nextId ? `${node.id}:${handle}:${nextId}` : undefined,
      branchLabel: handle,
    };
  }

  // Terminal nodes (transfer_extension, queue, voicemail_drop, hangup) and unknowns
  return { nextNodeId: undefined, edgeId: undefined, branchLabel: undefined };
}
