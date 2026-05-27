import { describe, expect, it } from 'vitest';
import type { Node } from 'reactflow';
import type { BuilderNodeData } from './ivr-flow-builder-utils';
import {
  addBuilderNode,
  builderStateToGraph,
  connectBuilderNodes,
  disconnectBuilderEdge,
  graphToBuilderEdges,
  graphToBuilderNodes,
  sanitizeBuilderGraph,
} from './ivr-flow-builder-utils';

describe('ivr-flow-builder-utils', () => {
  it('sanitizes invalid graph input to a minimal default graph', () => {
    const graph = sanitizeBuilderGraph(null);
    expect(graph.entry_node_id).toBe('start');
    expect(graph.nodes).toHaveLength(2);
  });

  it('converts graph nodes to builder edges and back without losing next/default semantics', () => {
    const graph = sanitizeBuilderGraph({
      entry_node_id: 'start',
      nodes: [
        { id: 'start', type: 'start', next_node_id: 'menu' },
        { id: 'menu', type: 'switch', input: '{{last_digits}}', cases: { '1': 'sales' }, default_node_id: 'hangup' },
        { id: 'sales', type: 'transfer_extension', extension_id: 'ext-1' },
        { id: 'hangup', type: 'hangup' },
      ],
    });

    const nodes = graphToBuilderNodes(graph);
    const edges = graphToBuilderEdges(graph);

    expect(edges.map((edge) => edge.sourceHandle)).toEqual(expect.arrayContaining(['next', 'case:1', 'default']));
    expect(builderStateToGraph(nodes)).toEqual(graph);
  });

  it('applies and removes switch-case edge connections correctly', () => {
    const initial = graphToBuilderNodes(
      sanitizeBuilderGraph({
        entry_node_id: 'start',
        nodes: [
          { id: 'start', type: 'start', next_node_id: 'menu' },
          { id: 'menu', type: 'switch', cases: { '1': '' }, default_node_id: undefined },
          { id: 'sales', type: 'transfer_extension', extension_id: 'ext-1' },
        ],
      }),
    );

    const connected = connectBuilderNodes(initial as Node<BuilderNodeData>[], 'menu', 'case:1', 'sales');
    expect((connected.find((node) => node.id === 'menu')!.data.graphNode as { cases?: Record<string, string> }).cases?.['1']).toBe('sales');

    const disconnected = disconnectBuilderEdge(connected, { source: 'menu', sourceHandle: 'case:1', target: 'sales' });
    expect((disconnected.find((node) => node.id === 'menu')!.data.graphNode as { cases?: Record<string, string> }).cases?.['1']).toBeUndefined();
  });

  it('creates unique node ids when adding multiple nodes of the same type', () => {
    const nodes = addBuilderNode([], 'hangup');
    const nextNodes = addBuilderNode(nodes, 'hangup');
    expect(nextNodes.map((node) => node.id)).toEqual(['hangup-1', 'hangup-2']);
  });
});
