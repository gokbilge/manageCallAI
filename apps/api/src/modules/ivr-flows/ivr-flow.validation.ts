import type { ValidationOutcome } from './ivr-flow.types.js';

// MVP node types only. Aliases (play, menu, transfer, condition) and future
// types (queue) are intentionally excluded — add them when the runtime
// supports them.
const SUPPORTED_NODE_TYPES = new Set([
  'start',
  'play_prompt',
  'play_collect',
  'switch',
  'transfer_extension',
  'hangup',
  'business_hours',
]);

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
      {
        id: 'start',
        type: 'start',
        next_node_id: 'end',
      },
      {
        id: 'end',
        type: 'hangup',
      },
    ],
  };
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
        message: `Unsupported node type: ${node.type}`,
      });
    }
  });

  if (typeof entryNodeId === 'string' && !nodeIds.has(entryNodeId)) {
    errors.push({ field: 'graph_json.entry_node_id', message: `Entry node does not exist: ${entryNodeId}` });
  }

  if (errors.length > 0) {
    return { status: 'failed', errors, warnings };
  }

  const reachable = new Set<string>();
  const visit = (id: string) => {
    if (reachable.has(id)) return;
    reachable.add(id);
    const node = nodes.find((item) => item.id === id);
    if (!node) return;

    pushMissingReference(errors, nodeIds, `graph_json.nodes.${id}.next_node_id`, node.next_node_id);
    pushMissingReference(errors, nodeIds, `graph_json.nodes.${id}.timeout_node_id`, node.timeout_node_id);
    pushMissingReference(errors, nodeIds, `graph_json.nodes.${id}.invalid_node_id`, node.invalid_node_id);
    pushMissingReference(errors, nodeIds, `graph_json.nodes.${id}.default_node_id`, node.default_node_id);

    for (const target of [node.next_node_id, node.timeout_node_id, node.invalid_node_id, node.default_node_id]) {
      if (typeof target === 'string' && nodeIds.has(target)) {
        visit(target);
      }
    }

    if (node.type === 'switch') {
      const cases = node.cases;
      if (cases && typeof cases === 'object' && !Array.isArray(cases)) {
        for (const [key, target] of Object.entries(cases as Record<string, unknown>)) {
          if (typeof target !== 'string') {
            errors.push({
              field: `graph_json.nodes.${id}.cases.${key}`,
              message: 'switch case targets must be string node ids',
            });
            continue;
          }
          if (!nodeIds.has(target)) {
            errors.push({
              field: `graph_json.nodes.${id}.cases.${key}`,
              message: `Referenced node does not exist: ${target}`,
            });
            continue;
          }
          visit(target);
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
      if (typeof node.in_hours_node_id === 'string' && nodeIds.has(node.in_hours_node_id)) visit(node.in_hours_node_id);
      if (typeof node.out_of_hours_node_id === 'string' && nodeIds.has(node.out_of_hours_node_id)) visit(node.out_of_hours_node_id);
    }
  };

  if (typeof entryNodeId === 'string' && nodeIds.has(entryNodeId)) {
    visit(entryNodeId);
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
