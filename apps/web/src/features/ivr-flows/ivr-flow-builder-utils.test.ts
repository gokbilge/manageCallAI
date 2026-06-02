import { describe, expect, it } from 'vitest';
import type { Node } from 'reactflow';
import type { BuilderNodeData } from './ivr-flow-builder-utils';
import {
  addBuilderNode,
  builderStateToGraph,
  connectBuilderNodes,
  createDefaultGraph,
  createNodeTemplate,
  disconnectBuilderEdge,
  graphToBuilderEdges,
  graphToBuilderNodes,
  sanitizeBuilderGraph,
  updateBuilderNode,
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

  it('creates the default graph shape used for empty drafts', () => {
    expect(createDefaultGraph()).toEqual({
      entry_node_id: 'start',
      nodes: [
        { id: 'start', type: 'start', next_node_id: 'hangup' },
        { id: 'hangup', type: 'hangup' },
      ],
    });
  });

  it('sanitizes malformed graph shapes without leaking invalid nodes', () => {
    expect(sanitizeBuilderGraph(undefined).entry_node_id).toBe('start');
    expect(sanitizeBuilderGraph([] as never).entry_node_id).toBe('start');

    const graph = sanitizeBuilderGraph({
      entry_node_id: 'missing',
      nodes: [
        null,
        { id: 12, type: 'hangup' },
        { id: 'first', type: 'hangup' },
        { id: 'second', type: 'queue', queue_id: 'q1' },
      ],
    });

    expect(graph.entry_node_id).toBe('first');
    expect(graph.nodes).toEqual([
      { id: 'first', type: 'hangup' },
      { id: 'second', type: 'queue', queue_id: 'q1' },
    ]);
  });

  it('creates node templates for every supported builder node type', () => {
    expect(createNodeTemplate('start', 'n')).toEqual({ id: 'n', type: 'start', next_node_id: undefined });
    expect(createNodeTemplate('play_prompt', 'n')).toEqual({ id: 'n', type: 'play_prompt', prompt_id: undefined, next_node_id: undefined });
    expect(createNodeTemplate('play_collect', 'n')).toEqual({
      id: 'n',
      type: 'play_collect',
      prompt_id: undefined,
      max_digits: 1,
      timeout_ms: 5000,
      retries: 0,
      next_node_id: undefined,
      timeout_node_id: undefined,
      invalid_node_id: undefined,
    });
    expect(createNodeTemplate('switch', 'n')).toEqual({ id: 'n', type: 'switch', input: '{{last_digits}}', cases: { '1': '' }, default_node_id: undefined });
    expect(createNodeTemplate('business_hours', 'n')).toEqual({ id: 'n', type: 'business_hours', schedule_id: undefined, in_hours_node_id: undefined, out_of_hours_node_id: undefined });
    expect(createNodeTemplate('caller_id_match', 'n')).toEqual({ id: 'n', type: 'caller_id_match', prefixes: ['+90'], match_node_id: undefined, no_match_node_id: undefined });
    expect(createNodeTemplate('set_variable', 'n')).toEqual({ id: 'n', type: 'set_variable', variable_name: undefined, value: '', next_node_id: undefined });
    expect(createNodeTemplate('transfer_extension', 'n')).toEqual({ id: 'n', type: 'transfer_extension', extension_id: undefined });
    expect(createNodeTemplate('queue', 'n')).toEqual({ id: 'n', type: 'queue', queue_id: undefined });
    expect(createNodeTemplate('voicemail_drop', 'n')).toEqual({ id: 'n', type: 'voicemail_drop', voicemail_box_id: undefined });
    expect(createNodeTemplate('hangup', 'n')).toEqual({ id: 'n', type: 'hangup' });
  });

  it('builds node titles, subtitles, outputs, and positions for every node type', () => {
    const graph = sanitizeBuilderGraph({
      entry_node_id: 'start',
      nodes: [
        { id: 'start', type: 'start', next_node_id: 'prompt' },
        { id: 'prompt', type: 'play_prompt', prompt_id: 'p1', next_node_id: 'collect' },
        { id: 'collect', type: 'play_collect', prompt_id: 'p2', max_digits: 3, next_node_id: 'switch', timeout_node_id: 'hangup', invalid_node_id: 'voicemail' },
        { id: 'switch', type: 'switch', cases: { '1': 'sales', '2': 'queue' }, default_node_id: 'hangup' },
        { id: 'hours', type: 'business_hours', schedule_id: 'sched1', in_hours_node_id: 'sales', out_of_hours_node_id: 'voicemail' },
        { id: 'caller', type: 'caller_id_match', prefixes: ['+90', '+1'], match_node_id: 'sales', no_match_node_id: 'queue' },
        { id: 'variable', type: 'set_variable', variable_name: 'tier', value: 'gold', next_node_id: 'queue' },
        { id: 'sales', type: 'transfer_extension', extension_id: 'ext1' },
        { id: 'queue', type: 'queue', queue_id: 'q1' },
        { id: 'voicemail', type: 'voicemail_drop', voicemail_box_id: 'vm1' },
        { id: 'hangup', type: 'hangup' },
      ],
    });

    const nodes = graphToBuilderNodes(graph);

    expect(nodes[0]?.position).toEqual({ x: 80, y: 120 });
    expect(nodes[1]?.position).toEqual({ x: 580, y: 80 });
    expect(nodes.map((node) => node.data.title)).toEqual([
      'Start',
      'Play Prompt',
      'Play Collect',
      'Switch',
      'Business Hours',
      'Caller ID Match',
      'Set Variable',
      'Transfer Extension',
      'Queue',
      'Voicemail',
      'Hangup',
    ]);
    expect(nodes.map((node) => node.data.subtitle)).toEqual([
      'Entry point',
      'Prompt p1',
      'Collect up to 3 digit(s)',
      '2 case(s)',
      'Schedule sched1',
      '2 prefix(es)',
      'tier = gold',
      'Extension ext1',
      'Queue q1',
      'Voicemail vm1',
      'Normal clearing',
    ]);
    expect(nodes.find((node) => node.id === 'collect')?.data.outputs.map((output) => output.id)).toEqual(['next', 'timeout', 'invalid']);
    expect(nodes.find((node) => node.id === 'switch')?.data.outputs.map((output) => output.id)).toEqual(['case:1', 'case:2', 'default']);
    expect(nodes.find((node) => node.id === 'hours')?.data.outputs.map((output) => output.id)).toEqual(['in_hours', 'out_of_hours']);
    expect(nodes.find((node) => node.id === 'caller')?.data.outputs.map((output) => output.id)).toEqual(['match', 'no_match']);
    expect(nodes.find((node) => node.id === 'hangup')?.data.outputs).toEqual([]);
  });

  it('uses fallback subtitles for incomplete node configuration', () => {
    const graph = sanitizeBuilderGraph({
      entry_node_id: 'prompt',
      nodes: [
        { id: 'prompt', type: 'play_prompt' },
        { id: 'collect', type: 'play_collect' },
        { id: 'switch', type: 'switch', cases: {} },
        { id: 'hours', type: 'business_hours' },
        { id: 'caller', type: 'caller_id_match', prefixes: [] },
        { id: 'variable', type: 'set_variable' },
        { id: 'sales', type: 'transfer_extension' },
        { id: 'queue', type: 'queue' },
        { id: 'voicemail', type: 'voicemail_drop' },
      ],
    });

    expect(graphToBuilderNodes(graph).map((node) => node.data.subtitle)).toEqual([
      'No prompt selected',
      'Prompt required',
      'No cases yet',
      'No schedule selected',
      'No prefixes yet',
      'No variable configured',
      'No extension selected',
      'No queue selected',
      'No voicemail box selected',
    ]);
  });

  it('converts all supported connection fields into edges', () => {
    const graph = sanitizeBuilderGraph({
      entry_node_id: 'start',
      nodes: [
        { id: 'start', type: 'start', next_node_id: 'prompt' },
        { id: 'prompt', type: 'play_prompt', next_node_id: 'collect' },
        { id: 'collect', type: 'play_collect', next_node_id: 'switch', timeout_node_id: 'hangup', invalid_node_id: 'voicemail' },
        { id: 'switch', type: 'switch', cases: { '1': 'sales', '2': '' }, default_node_id: 'hangup' },
        { id: 'hours', type: 'business_hours', in_hours_node_id: 'sales', out_of_hours_node_id: 'voicemail' },
        { id: 'caller', type: 'caller_id_match', match_node_id: 'sales', no_match_node_id: 'queue' },
        { id: 'sales', type: 'transfer_extension' },
        { id: 'queue', type: 'queue' },
        { id: 'voicemail', type: 'voicemail_drop' },
        { id: 'hangup', type: 'hangup' },
      ],
    });

    expect(graphToBuilderEdges(graph).map((edge) => `${edge.source}:${edge.sourceHandle}:${edge.target}`)).toEqual([
      'start:next:prompt',
      'prompt:next:collect',
      'collect:next:switch',
      'collect:timeout:hangup',
      'collect:invalid:voicemail',
      'switch:case:1:sales',
      'switch:default:hangup',
      'hours:in_hours:sales',
      'hours:out_of_hours:voicemail',
      'caller:match:sales',
      'caller:no_match:queue',
    ]);
  });

  it('connects and disconnects every supported handle type', () => {
    const nodes = graphToBuilderNodes(sanitizeBuilderGraph({
      entry_node_id: 'start',
      nodes: [
        { id: 'start', type: 'start', next_node_id: '' },
        { id: 'collect', type: 'play_collect', next_node_id: '' },
        { id: 'switch', type: 'switch' },
        { id: 'hours', type: 'business_hours' },
        { id: 'caller', type: 'caller_id_match' },
        { id: 'variable', type: 'set_variable', next_node_id: '' },
        { id: 'target', type: 'hangup' },
      ],
    })) as Node<BuilderNodeData>[];

    const connected = [
      ['start', null],
      ['collect', 'next'],
      ['collect', 'timeout'],
      ['collect', 'invalid'],
      ['switch', 'default'],
      ['switch', 'case:vip'],
      ['hours', 'in_hours'],
      ['hours', 'out_of_hours'],
      ['caller', 'match'],
      ['caller', 'no_match'],
      ['variable', 'next'],
    ].reduce(
      (current, [source, handle]) => connectBuilderNodes(current, source!, handle, 'target'),
      nodes,
    );

    expect(builderStateToGraph(connected).nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'start', next_node_id: 'target' }),
      expect.objectContaining({ id: 'collect', next_node_id: 'target', timeout_node_id: 'target', invalid_node_id: 'target' }),
      expect.objectContaining({ id: 'switch', default_node_id: 'target', cases: { vip: 'target' } }),
      expect.objectContaining({ id: 'hours', in_hours_node_id: 'target', out_of_hours_node_id: 'target' }),
      expect.objectContaining({ id: 'caller', match_node_id: 'target', no_match_node_id: 'target' }),
      expect.objectContaining({ id: 'variable', next_node_id: 'target' }),
    ]));

    const disconnected = [
      ['start', null],
      ['collect', 'next'],
      ['collect', 'timeout'],
      ['collect', 'invalid'],
      ['switch', 'default'],
      ['switch', 'case:vip'],
      ['hours', 'in_hours'],
      ['hours', 'out_of_hours'],
      ['caller', 'match'],
      ['caller', 'no_match'],
      ['variable', 'next'],
    ].reduce(
      (current, [source, sourceHandle]) => disconnectBuilderEdge(current, { source: source!, sourceHandle, target: 'target' }),
      connected,
    );

    expect(graphToBuilderEdges(builderStateToGraph(disconnected))).toEqual([]);
  });

  it('leaves nodes unchanged for unsupported or mismatched connections', () => {
    const nodes = graphToBuilderNodes(sanitizeBuilderGraph({
      entry_node_id: 'hangup',
      nodes: [{ id: 'hangup', type: 'hangup' }, { id: 'target', type: 'hangup' }],
    })) as Node<BuilderNodeData>[];

    expect(connectBuilderNodes(nodes, 'missing', 'next', 'target')).toEqual(nodes);
    expect(connectBuilderNodes(nodes, 'hangup', 'next', 'target')).toEqual(nodes);
    expect(disconnectBuilderEdge(nodes, { source: 'hangup', sourceHandle: 'next', target: 'other' })).toEqual(nodes);
  });

  it('normalizes existing start nodes when adding a new start node', () => {
    const nodes = addBuilderNode(graphToBuilderNodes(createDefaultGraph()) as Node<BuilderNodeData>[], 'start');
    const graph = builderStateToGraph(nodes);

    expect(graph.nodes.filter((node) => node.type === 'start')).toHaveLength(1);
    expect(graph.nodes.some((node) => node.id === 'start' && node.type === 'hangup')).toBe(true);
  });

  it('updates node metadata after graph-node edits', () => {
    const [node] = graphToBuilderNodes(sanitizeBuilderGraph({
      entry_node_id: 'queue',
      nodes: [{ id: 'queue', type: 'queue' }],
    })) as Node<BuilderNodeData>[];

    const updated = updateBuilderNode(node!, { queue_id: 'support' });

    expect(updated.data.subtitle).toBe('Queue support');
    expect(updated.data.graphNode).toEqual({ id: 'queue', type: 'queue', queue_id: 'support' });
  });

  it('falls back to start as the entry id when builder state is empty', () => {
    expect(builderStateToGraph([])).toEqual({ entry_node_id: 'start', nodes: [] });
  });
});
