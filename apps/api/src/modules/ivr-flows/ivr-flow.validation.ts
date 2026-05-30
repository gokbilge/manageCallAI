import { IVR_NODE_TYPES } from '@managecallai/contracts';
import type { ValidationOutcome } from './ivr-flow.types.js';

// Canonical node types come from packages/contracts so MCP and API stay in sync.
const SUPPORTED_NODE_TYPES = new Set<string>(IVR_NODE_TYPES);

// Maximum number of distinct nodes that can be visited in a single traversal
// path before a loop is detected. Prevents infinite cycles in published flows.
const MAX_TRAVERSAL_DEPTH = 50;

type GraphNode = Record<string, unknown> & {
  id: string;
  type: string;
};

function isGraphNode(value: unknown): value is GraphNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && typeof (value as Record<string, unknown>).id === 'string'
    && typeof (value as Record<string, unknown>).type === 'string';
}

function pushMissingReference(
  errors: ValidationOutcome['errors'],
  nodeIds: Set<string>,
  field: string,
  target: unknown,
) {
  if (typeof target === 'string' && !nodeIds.has(target)) {
    errors.push({ field, message: `Referenced node does not exist: ${target}` });
  }
}

export function defaultIvrGraph(): Record<string, unknown> {
  return {
    entry_node_id: 'start',
    nodes: [
      { id: 'start', type: 'start', next_node_id: 'end' },
      { id: 'end', type: 'hangup' },
    ],
  };
}

/**
 * Returns the set of branch IDs reachable from a given node, used for
 * computing simulation coverage (which branches were tested).
 */
export function computeReachableBranches(graph: unknown): Set<string> {
  const ids = new Set<string>();
  if (typeof graph !== 'object' || graph === null) return ids;
  const g = graph as Record<string, unknown>;
  if (!Array.isArray(g.nodes)) return ids;
  for (const n of g.nodes as unknown[]) {
    if (isGraphNode(n)) ids.add(n.id);
  }
  return ids;
}

export function validateIvrGraph(graph: unknown): ValidationOutcome {
  const errors: ValidationOutcome['errors'] = [];
  const warnings: ValidationOutcome['warnings'] = [];

  if (typeof graph !== 'object' || graph === null || Array.isArray(graph)) {
    return {
      status: 'failed',
      errors: [{ field: 'graph_json', message: 'graph_json must be a JSON object' }],
      warnings,
    };
  }

  const graphObject = graph as Record<string, unknown>;
  const entryNodeId = graphObject.entry_node_id;
  const nodesValue = graphObject.nodes;

  if (typeof entryNodeId !== 'string' || entryNodeId.length === 0) {
    errors.push({ field: 'graph_json.entry_node_id', message: 'entry_node_id is required' });
  }

  if (!Array.isArray(nodesValue)) {
    errors.push({ field: 'graph_json.nodes', message: 'nodes must be an array' });
    return { status: 'failed', errors, warnings };
  }

  if (nodesValue.length === 0) {
    errors.push({ field: 'graph_json.nodes', message: 'nodes must contain at least one node' });
    return { status: 'failed', errors, warnings };
  }

  const nodes: GraphNode[] = [];
  const nodeIds = new Set<string>();

  nodesValue.forEach((node, index) => {
    if (!isGraphNode(node)) {
      errors.push({ field: `graph_json.nodes[${index}]`, message: 'Each node must include string id and type fields' });
      return;
    }
    if (nodeIds.has(node.id)) {
      errors.push({ field: `graph_json.nodes[${index}].id`, message: `Duplicate node id: ${node.id}` });
      return;
    }
    nodeIds.add(node.id);
    nodes.push(node);

    if (!SUPPORTED_NODE_TYPES.has(node.type)) {
      errors.push({
        field: `graph_json.nodes[${index}].type`,
        message: `Unsupported node type: ${node.type}. Supported: ${[...SUPPORTED_NODE_TYPES].join(', ')}`,
      });
    }

    // fallback_node_id reference validity is checked in the traversal phase (visit)
    // after all node IDs are collected.

    // Validate max_retries is a non-negative integer when present.
    if (node.max_retries !== undefined) {
      if (typeof node.max_retries !== 'number' || !Number.isInteger(node.max_retries) || node.max_retries < 0) {
        errors.push({
          field: `graph_json.nodes.${node.id}.max_retries`,
          message: 'max_retries must be a non-negative integer',
        });
      }
    }

    // play_prompt and play_collect: warn if no prompt_id or prompt_uri
    if (node.type === 'play_prompt' || node.type === 'play_collect') {
      if (!node.prompt_id && !node.prompt_uri) {
        warnings.push({
          field: `graph_json.nodes.${node.id}`,
          message: `${node.type} node has no prompt_id or prompt_uri — callers will hear silence`,
        });
      }
    }
  });

  if (typeof entryNodeId === 'string' && !nodeIds.has(entryNodeId)) {
    errors.push({ field: 'graph_json.entry_node_id', message: `Entry node does not exist: ${entryNodeId}` });
  }

  if (errors.length > 0) {
    return { status: 'failed', errors, warnings };
  }

  // ── Traversal: reachability + loop detection ──────────────────────────────

  const reachable = new Set<string>();

  const visit = (id: string, depth: number) => {
    if (depth > MAX_TRAVERSAL_DEPTH) {
      errors.push({
        field: `graph_json`,
        message: `Possible infinite loop detected: traversal exceeded ${MAX_TRAVERSAL_DEPTH} nodes starting from entry. Check for cycles.`,
      });
      return;
    }
    if (reachable.has(id)) return;
    reachable.add(id);
    const node = nodes.find((item) => item.id === id);
    if (!node) return;

    pushMissingReference(errors, nodeIds, `graph_json.nodes.${id}.next_node_id`, node.next_node_id);
    pushMissingReference(errors, nodeIds, `graph_json.nodes.${id}.timeout_node_id`, node.timeout_node_id);
    pushMissingReference(errors, nodeIds, `graph_json.nodes.${id}.invalid_node_id`, node.invalid_node_id);
    pushMissingReference(errors, nodeIds, `graph_json.nodes.${id}.default_node_id`, node.default_node_id);
    pushMissingReference(errors, nodeIds, `graph_json.nodes.${id}.fallback_node_id`, node.fallback_node_id);

    for (const target of [
      node.next_node_id, node.timeout_node_id, node.invalid_node_id,
      node.default_node_id, node.fallback_node_id,
    ]) {
      if (typeof target === 'string' && nodeIds.has(target)) {
        visit(target, depth + 1);
      }
    }

    if (node.type === 'switch') {
      const cases = node.cases;
      if (cases && typeof cases === 'object' && !Array.isArray(cases)) {
        for (const [key, target] of Object.entries(cases as Record<string, unknown>)) {
          if (typeof target !== 'string') {
            errors.push({ field: `graph_json.nodes.${id}.cases.${key}`, message: 'switch case targets must be string node ids' });
            continue;
          }
          if (!nodeIds.has(target)) {
            errors.push({ field: `graph_json.nodes.${id}.cases.${key}`, message: `Referenced node does not exist: ${target}` });
            continue;
          }
          visit(target, depth + 1);
        }
      } else {
        errors.push({ field: `graph_json.nodes.${id}.cases`, message: 'switch nodes must define a cases object' });
      }
    }

    if (node.type === 'business_hours') {
      if (typeof node.schedule_id !== 'string' || node.schedule_id.length === 0) {
        errors.push({ field: `graph_json.nodes.${id}.schedule_id`, message: 'business_hours nodes require a schedule_id' });
      }
      pushMissingReference(errors, nodeIds, `graph_json.nodes.${id}.in_hours_node_id`, node.in_hours_node_id);
      pushMissingReference(errors, nodeIds, `graph_json.nodes.${id}.out_of_hours_node_id`, node.out_of_hours_node_id);
      if (typeof node.in_hours_node_id === 'string' && nodeIds.has(node.in_hours_node_id)) visit(node.in_hours_node_id, depth + 1);
      if (typeof node.out_of_hours_node_id === 'string' && nodeIds.has(node.out_of_hours_node_id)) visit(node.out_of_hours_node_id, depth + 1);
    }

    if (node.type === 'caller_id_match') {
      if (!Array.isArray(node.prefixes) || (node.prefixes as unknown[]).length === 0) {
        errors.push({ field: `graph_json.nodes.${id}.prefixes`, message: 'caller_id_match nodes require a non-empty prefixes array' });
      }
      pushMissingReference(errors, nodeIds, `graph_json.nodes.${id}.match_node_id`, node.match_node_id);
      pushMissingReference(errors, nodeIds, `graph_json.nodes.${id}.no_match_node_id`, node.no_match_node_id);
      if (typeof node.match_node_id === 'string' && nodeIds.has(node.match_node_id)) visit(node.match_node_id, depth + 1);
      if (typeof node.no_match_node_id === 'string' && nodeIds.has(node.no_match_node_id)) visit(node.no_match_node_id, depth + 1);
    }

    if (node.type === 'set_variable') {
      if (typeof node.variable_name !== 'string' || node.variable_name.length === 0) {
        errors.push({ field: `graph_json.nodes.${id}.variable_name`, message: 'set_variable nodes require a variable_name' });
      }
      if (typeof node.value !== 'string') {
        errors.push({ field: `graph_json.nodes.${id}.value`, message: 'set_variable nodes require a string value' });
      }
    }

    if (node.type === 'queue') {
      if (typeof node.queue_id !== 'string' || node.queue_id.length === 0) {
        errors.push({ field: `graph_json.nodes.${id}.queue_id`, message: 'queue nodes require a queue_id' });
      }
    }

    if (node.type === 'voicemail_drop') {
      if (typeof node.voicemail_box_id !== 'string' || node.voicemail_box_id.length === 0) {
        errors.push({ field: `graph_json.nodes.${id}.voicemail_box_id`, message: 'voicemail_drop nodes require a voicemail_box_id' });
      }
    }
  };

  if (typeof entryNodeId === 'string' && nodeIds.has(entryNodeId)) {
    visit(entryNodeId, 0);
  }

  for (const node of nodes) {
    if (!reachable.has(node.id)) {
      warnings.push({
        field: `graph_json.nodes.${node.id}`,
        message: 'Node is currently unreachable from entry_node_id',
      });
    }
  }

  return {
    status: errors.length > 0 ? 'failed' : 'passed',
    errors,
    warnings,
  };
}
