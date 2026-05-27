import type { Edge, Node, XYPosition } from 'reactflow';

export type BuilderNodeType =
  | 'start'
  | 'play_prompt'
  | 'play_collect'
  | 'switch'
  | 'transfer_extension'
  | 'hangup';

type BaseBuilderGraphNode = {
  id: string;
  type: BuilderNodeType;
};

export type StartBuilderNode = BaseBuilderGraphNode & {
  type: 'start';
  next_node_id?: string;
};

export type PlayPromptBuilderNode = BaseBuilderGraphNode & {
  type: 'play_prompt';
  prompt_id?: string;
  next_node_id?: string;
};

export type PlayCollectBuilderNode = BaseBuilderGraphNode & {
  type: 'play_collect';
  prompt_id?: string;
  max_digits?: number;
  timeout_ms?: number;
  retries?: number;
  next_node_id?: string;
  timeout_node_id?: string;
  invalid_node_id?: string;
};

export type SwitchBuilderNode = BaseBuilderGraphNode & {
  type: 'switch';
  input?: string;
  cases?: Record<string, string>;
  default_node_id?: string;
};

export type TransferBuilderNode = BaseBuilderGraphNode & {
  type: 'transfer_extension';
  extension_id?: string;
};

export type HangupBuilderNode = BaseBuilderGraphNode & {
  type: 'hangup';
};

export type BuilderGraphNode =
  | StartBuilderNode
  | PlayPromptBuilderNode
  | PlayCollectBuilderNode
  | SwitchBuilderNode
  | TransferBuilderNode
  | HangupBuilderNode;

export type BuilderGraphJson = {
  entry_node_id: string;
  nodes: BuilderGraphNode[];
};

export type BuilderNodeData = {
  graphNode: BuilderGraphNode;
  title: string;
  subtitle: string;
  outputs: Array<{ id: string; label: string }>;
};

export const BUILDER_NODE_TYPES: Array<{ type: BuilderNodeType; label: string; description: string }> = [
  { type: 'start', label: 'Start', description: 'Entry node for the flow.' },
  { type: 'play_prompt', label: 'Play Prompt', description: 'Play a prompt and continue.' },
  { type: 'play_collect', label: 'Play Collect', description: 'Play a prompt and collect DTMF input.' },
  { type: 'switch', label: 'Switch', description: 'Branch based on last digits or variables.' },
  { type: 'transfer_extension', label: 'Transfer Extension', description: 'Bridge the caller to an extension.' },
  { type: 'hangup', label: 'Hangup', description: 'End the call.' },
];

const DEFAULT_INPUT = '{{last_digits}}';

function cloneNode<T extends BuilderGraphNode>(node: T): T {
  return JSON.parse(JSON.stringify(node)) as T;
}

export function createDefaultGraph(): BuilderGraphJson {
  return {
    entry_node_id: 'start',
    nodes: [
      { id: 'start', type: 'start', next_node_id: 'hangup' },
      { id: 'hangup', type: 'hangup' },
    ],
  };
}

export function sanitizeBuilderGraph(input: Record<string, unknown> | null | undefined): BuilderGraphJson {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return createDefaultGraph();
  }

  const rawNodes = Array.isArray(input.nodes) ? input.nodes : [];
  const nodes = rawNodes
    .filter((node): node is BuilderGraphNode => typeof node === 'object' && node !== null && typeof (node as { id?: unknown }).id === 'string' && typeof (node as { type?: unknown }).type === 'string')
    .map((node) => cloneNode(node as BuilderGraphNode));

  if (nodes.length === 0) {
    return createDefaultGraph();
  }

  const entryNodeId =
    typeof input.entry_node_id === 'string' && nodes.some((node) => node.id === input.entry_node_id)
      ? input.entry_node_id
      : nodes[0]!.id;

  return {
    entry_node_id: entryNodeId,
    nodes,
  };
}

function nodeTitle(node: BuilderGraphNode): string {
  switch (node.type) {
    case 'start':
      return 'Start';
    case 'play_prompt':
      return 'Play Prompt';
    case 'play_collect':
      return 'Play Collect';
    case 'switch':
      return 'Switch';
    case 'transfer_extension':
      return 'Transfer Extension';
    case 'hangup':
      return 'Hangup';
  }
}

function nodeSubtitle(node: BuilderGraphNode): string {
  switch (node.type) {
    case 'play_prompt':
      return node.prompt_id ? `Prompt ${node.prompt_id}` : 'No prompt selected';
    case 'play_collect':
      return node.prompt_id ? `Collect up to ${node.max_digits ?? 1} digit(s)` : 'Prompt required';
    case 'switch':
      return Object.keys(node.cases ?? {}).length > 0 ? `${Object.keys(node.cases ?? {}).length} case(s)` : 'No cases yet';
    case 'transfer_extension':
      return node.extension_id ? `Extension ${node.extension_id}` : 'No extension selected';
    case 'hangup':
      return 'Normal clearing';
    case 'start':
      return 'Entry point';
  }
}

function nodeOutputs(node: BuilderGraphNode): Array<{ id: string; label: string }> {
  switch (node.type) {
    case 'start':
    case 'play_prompt':
      return [{ id: 'next', label: 'Next' }];
    case 'play_collect':
      return [
        { id: 'next', label: 'Digits' },
        { id: 'timeout', label: 'Timeout' },
        { id: 'invalid', label: 'Invalid' },
      ];
    case 'switch':
      return [
        ...Object.keys(node.cases ?? {}).map((key) => ({ id: `case:${key}`, label: key })),
        { id: 'default', label: 'Default' },
      ];
    case 'transfer_extension':
    case 'hangup':
      return [];
  }
}

export function graphToBuilderNodes(graph: BuilderGraphJson): Node<BuilderNodeData>[] {
  return graph.nodes.map((graphNode, index) => ({
    id: graphNode.id,
    type: 'ivrNode',
    position: defaultPosition(index, graphNode.type),
    data: {
      graphNode,
      title: nodeTitle(graphNode),
      subtitle: nodeSubtitle(graphNode),
      outputs: nodeOutputs(graphNode),
    },
  }));
}

export function graphToBuilderEdges(graph: BuilderGraphJson): Edge[] {
  const edges: Edge[] = [];

  for (const node of graph.nodes) {
    if ('next_node_id' in node && node.next_node_id) {
      edges.push({ id: `${node.id}:next:${node.next_node_id}`, source: node.id, sourceHandle: 'next', target: node.next_node_id });
    }

    if (node.type === 'play_collect') {
      if (node.timeout_node_id) {
        edges.push({ id: `${node.id}:timeout:${node.timeout_node_id}`, source: node.id, sourceHandle: 'timeout', target: node.timeout_node_id });
      }
      if (node.invalid_node_id) {
        edges.push({ id: `${node.id}:invalid:${node.invalid_node_id}`, source: node.id, sourceHandle: 'invalid', target: node.invalid_node_id });
      }
    }

    if (node.type === 'switch') {
      for (const [key, target] of Object.entries(node.cases ?? {})) {
        if (target) {
          edges.push({ id: `${node.id}:case:${key}:${target}`, source: node.id, sourceHandle: `case:${key}`, target });
        }
      }
      if (node.default_node_id) {
        edges.push({ id: `${node.id}:default:${node.default_node_id}`, source: node.id, sourceHandle: 'default', target: node.default_node_id });
      }
    }
  }

  return edges;
}

export function builderStateToGraph(nodes: Node<BuilderNodeData>[]): BuilderGraphJson {
  const graphNodes = nodes.map((node) => cloneNode(node.data.graphNode));
  const entryNode = graphNodes.find((node) => node.type === 'start') ?? graphNodes[0];
  return {
    entry_node_id: entryNode?.id ?? 'start',
    nodes: graphNodes,
  };
}

export function addBuilderNode(
  nodes: Node<BuilderNodeData>[],
  type: BuilderNodeType,
): Node<BuilderNodeData>[] {
  const id = createNodeId(nodes, type);
  const graphNode = createNodeTemplate(type, id);
  const appended = [
    ...nodes,
    {
      id,
      type: 'ivrNode',
      position: { x: 140 + ((nodes.length % 3) * 220), y: 80 + (Math.floor(nodes.length / 3) * 180) },
      data: {
        graphNode,
        title: nodeTitle(graphNode),
        subtitle: nodeSubtitle(graphNode),
        outputs: nodeOutputs(graphNode),
      },
    },
  ];

  if (type === 'start') {
    return normalizeSingleStart(appended, id);
  }

  return appended;
}

function normalizeSingleStart(nodes: Node<BuilderNodeData>[], keepId: string): Node<BuilderNodeData>[] {
  return nodes.map((node) => {
    if (node.id === keepId) return node;
    if (node.data.graphNode.type !== 'start') return node;
    return updateBuilderNode(node, { type: 'hangup' });
  });
}

function defaultPosition(index: number, type: BuilderNodeType): XYPosition {
  if (type === 'start') return { x: 80, y: 120 };
  return {
    x: 320 + ((index % 2) * 260),
    y: 80 + (Math.floor(index / 2) * 180),
  };
}

export function updateBuilderNode(node: Node<BuilderNodeData>, patch: Partial<BuilderGraphNode>): Node<BuilderNodeData> {
  const graphNode = { ...cloneNode(node.data.graphNode), ...patch } as BuilderGraphNode;
  return {
    ...node,
    data: {
      graphNode,
      title: nodeTitle(graphNode),
      subtitle: nodeSubtitle(graphNode),
      outputs: nodeOutputs(graphNode),
    },
  };
}

export function connectBuilderNodes(
  nodes: Node<BuilderNodeData>[],
  sourceId: string,
  handleId: string | null,
  targetId: string,
): Node<BuilderNodeData>[] {
  const sourceHandle = handleId ?? 'next';
  return nodes.map((node) => {
    if (node.id !== sourceId) return node;
    const graphNode = cloneNode(node.data.graphNode);

    if (sourceHandle === 'next' && ('next_node_id' in graphNode)) {
      return updateBuilderNode(node, { next_node_id: targetId } as Partial<BuilderGraphNode>);
    }
    if (sourceHandle === 'timeout' && graphNode.type === 'play_collect') {
      return updateBuilderNode(node, { timeout_node_id: targetId });
    }
    if (sourceHandle === 'invalid' && graphNode.type === 'play_collect') {
      return updateBuilderNode(node, { invalid_node_id: targetId });
    }
    if (sourceHandle === 'default' && graphNode.type === 'switch') {
      return updateBuilderNode(node, { default_node_id: targetId });
    }
    if (sourceHandle.startsWith('case:') && graphNode.type === 'switch') {
      const caseKey = sourceHandle.slice('case:'.length);
      const cases = { ...(graphNode.cases ?? {}), [caseKey]: targetId };
      return updateBuilderNode(node, { cases });
    }
    return node;
  });
}

export function disconnectBuilderEdge(
  nodes: Node<BuilderNodeData>[],
  edge: Pick<Edge, 'source' | 'sourceHandle' | 'target'>,
): Node<BuilderNodeData>[] {
  const handle = edge.sourceHandle ?? 'next';
  return nodes.map((node) => {
    if (node.id !== edge.source) return node;
    const graphNode = cloneNode(node.data.graphNode);

    if (handle === 'next' && 'next_node_id' in graphNode && graphNode.next_node_id === edge.target) {
      return updateBuilderNode(node, { next_node_id: undefined } as Partial<BuilderGraphNode>);
    }
    if (handle === 'timeout' && graphNode.type === 'play_collect' && graphNode.timeout_node_id === edge.target) {
      return updateBuilderNode(node, { timeout_node_id: undefined });
    }
    if (handle === 'invalid' && graphNode.type === 'play_collect' && graphNode.invalid_node_id === edge.target) {
      return updateBuilderNode(node, { invalid_node_id: undefined });
    }
    if (handle === 'default' && graphNode.type === 'switch' && graphNode.default_node_id === edge.target) {
      return updateBuilderNode(node, { default_node_id: undefined });
    }
    if (handle.startsWith('case:') && graphNode.type === 'switch') {
      const caseKey = handle.slice('case:'.length);
      if ((graphNode.cases ?? {})[caseKey] === edge.target) {
        const nextCases = { ...(graphNode.cases ?? {}) };
        delete nextCases[caseKey];
        return updateBuilderNode(node, { cases: nextCases });
      }
    }
    return node;
  });
}

export function createNodeTemplate(type: BuilderNodeType, id: string): BuilderGraphNode {
  switch (type) {
    case 'start':
      return { id, type, next_node_id: undefined };
    case 'play_prompt':
      return { id, type, prompt_id: undefined, next_node_id: undefined };
    case 'play_collect':
      return {
        id,
        type,
        prompt_id: undefined,
        max_digits: 1,
        timeout_ms: 5000,
        retries: 0,
        next_node_id: undefined,
        timeout_node_id: undefined,
        invalid_node_id: undefined,
      };
    case 'switch':
      return { id, type, input: DEFAULT_INPUT, cases: { '1': '' }, default_node_id: undefined };
    case 'transfer_extension':
      return { id, type, extension_id: undefined };
    case 'hangup':
      return { id, type };
  }
}

function createNodeId(nodes: Node<BuilderNodeData>[], type: BuilderNodeType): string {
  const base = type.replaceAll('_', '-');
  let index = 1;
  let candidate = `${base}-${index}`;
  const ids = new Set(nodes.map((node) => node.id));
  while (ids.has(candidate)) {
    index += 1;
    candidate = `${base}-${index}`;
  }
  return candidate;
}
