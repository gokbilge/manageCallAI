import { describe, expect, it } from 'vitest';
import { buildPlannerGraph, resolveNextNode, resolveSwitchInput } from './ivr-graph-planner.js';

const emptyCtx = {
  lastDigits: undefined,
  callerNumber: undefined,
  scenarioHour: undefined,
  variables: {},
};

describe('buildPlannerGraph', () => {
  it('builds a graph with correct entryNodeId', () => {
    const graph = buildPlannerGraph({
      entry_node_id: 'start',
      nodes: [{ id: 'start', type: 'start', next_node_id: 'end' }, { id: 'end', type: 'hangup' }],
    });
    expect(graph.entryNodeId).toBe('start');
    expect(graph.nodes.size).toBe(2);
  });

  it('annotates each node with its BPMN category', () => {
    const graph = buildPlannerGraph({
      entry_node_id: 'start',
      nodes: [
        { id: 'start', type: 'start' },
        { id: 'play', type: 'play_prompt' },
        { id: 'sw', type: 'switch' },
        { id: 'end', type: 'hangup' },
      ],
    });
    expect(graph.nodes.get('start')?.category).toBe('start');
    expect(graph.nodes.get('play')?.category).toBe('task');
    expect(graph.nodes.get('sw')?.category).toBe('gateway');
    expect(graph.nodes.get('end')?.category).toBe('end');
  });

  it('sets category to undefined for unknown node types', () => {
    const graph = buildPlannerGraph({
      entry_node_id: 'x',
      nodes: [{ id: 'x', type: 'unknownType' }],
    });
    expect(graph.nodes.get('x')?.category).toBeUndefined();
  });

  it('returns empty nodes map for invalid graph shape', () => {
    const graph = buildPlannerGraph({});
    expect(graph.nodes.size).toBe(0);
    expect(graph.entryNodeId).toBe('');
  });
});

describe('resolveNextNode — branch selection', () => {
  it('start: returns next:next edge', () => {
    const graph = buildPlannerGraph({
      entry_node_id: 's',
      nodes: [{ id: 's', type: 'start', next_node_id: 'n' }],
    });
    const node = graph.nodes.get('s')!;
    const { nextNodeId, edgeId, branchLabel } = resolveNextNode(node, emptyCtx);
    expect(nextNodeId).toBe('n');
    expect(edgeId).toBe('s:next:n');
    expect(branchLabel).toBe('next');
  });

  it('play_prompt: returns next edge', () => {
    const graph = buildPlannerGraph({
      entry_node_id: 'p',
      nodes: [{ id: 'p', type: 'play_prompt', next_node_id: 'end' }],
    });
    const { nextNodeId, edgeId } = resolveNextNode(graph.nodes.get('p')!, emptyCtx);
    expect(nextNodeId).toBe('end');
    expect(edgeId).toBe('p:next:end');
  });

  it('set_variable: returns next edge', () => {
    const graph = buildPlannerGraph({
      entry_node_id: 'sv',
      nodes: [{ id: 'sv', type: 'set_variable', next_node_id: 'end', variable_name: 'x', value: '1' }],
    });
    const { nextNodeId, edgeId } = resolveNextNode(graph.nodes.get('sv')!, emptyCtx);
    expect(nextNodeId).toBe('end');
    expect(edgeId).toBe('sv:next:end');
  });

  it('play_collect: digits branch on default outcome', () => {
    const graph = buildPlannerGraph({
      entry_node_id: 'pc',
      nodes: [{ id: 'pc', type: 'play_collect', next_node_id: 'nxt', timeout_node_id: 'to', invalid_node_id: 'inv' }],
    });
    const { nextNodeId, edgeId, branchLabel } = resolveNextNode(graph.nodes.get('pc')!, emptyCtx, { kind: 'digits', digits: '1' });
    expect(nextNodeId).toBe('nxt');
    expect(edgeId).toBe('pc:next:nxt');
    expect(branchLabel).toBe('digits');
  });

  it('play_collect: timeout branch', () => {
    const graph = buildPlannerGraph({
      entry_node_id: 'pc',
      nodes: [{ id: 'pc', type: 'play_collect', next_node_id: 'nxt', timeout_node_id: 'to' }],
    });
    const { nextNodeId, edgeId } = resolveNextNode(graph.nodes.get('pc')!, emptyCtx, { kind: 'timeout' });
    expect(nextNodeId).toBe('to');
    expect(edgeId).toBe('pc:timeout:to');
  });

  it('play_collect: invalid branch', () => {
    const graph = buildPlannerGraph({
      entry_node_id: 'pc',
      nodes: [{ id: 'pc', type: 'play_collect', next_node_id: 'nxt', invalid_node_id: 'inv' }],
    });
    const { nextNodeId, edgeId } = resolveNextNode(graph.nodes.get('pc')!, emptyCtx, { kind: 'invalid' });
    expect(nextNodeId).toBe('inv');
    expect(edgeId).toBe('pc:invalid:inv');
  });

  it('play_collect: falls back to default when no invalid_node_id', () => {
    const graph = buildPlannerGraph({
      entry_node_id: 'pc',
      nodes: [{ id: 'pc', type: 'play_collect', next_node_id: 'nxt', default_node_id: 'def' }],
    });
    const { nextNodeId, edgeId, branchLabel } = resolveNextNode(graph.nodes.get('pc')!, emptyCtx, { kind: 'invalid' });
    expect(nextNodeId).toBe('def');
    expect(edgeId).toBe('pc:default:def');
    expect(branchLabel).toBe('default');
  });

  it('switch: selects matching case edge', () => {
    const graph = buildPlannerGraph({
      entry_node_id: 'sw',
      nodes: [{ id: 'sw', type: 'switch', input: '{{last_digits}}', cases: { '1': 'sales', '2': 'support' }, default_node_id: 'def' }],
    });
    const ctx = { ...emptyCtx, lastDigits: '1' };
    const { nextNodeId, edgeId, branchLabel } = resolveNextNode(graph.nodes.get('sw')!, ctx);
    expect(nextNodeId).toBe('sales');
    expect(edgeId).toBe('sw:case:1:sales');
    expect(branchLabel).toBe('case:1');
  });

  it('switch: falls back to default when no matching case', () => {
    const graph = buildPlannerGraph({
      entry_node_id: 'sw',
      nodes: [{ id: 'sw', type: 'switch', cases: { '1': 'sales' }, default_node_id: 'def' }],
    });
    const ctx = { ...emptyCtx, lastDigits: '9' };
    const { nextNodeId, edgeId } = resolveNextNode(graph.nodes.get('sw')!, ctx);
    expect(nextNodeId).toBe('def');
    expect(edgeId).toBe('sw:default:def');
  });

  it('caller_id_match: match branch', () => {
    const graph = buildPlannerGraph({
      entry_node_id: 'cm',
      nodes: [{ id: 'cm', type: 'caller_id_match', prefixes: ['+90'], match_node_id: 'vip', no_match_node_id: 'gen' }],
    });
    const ctx = { ...emptyCtx, callerNumber: '+905551112233' };
    const { nextNodeId, edgeId, branchLabel } = resolveNextNode(graph.nodes.get('cm')!, ctx);
    expect(nextNodeId).toBe('vip');
    expect(edgeId).toBe('cm:match:vip');
    expect(branchLabel).toBe('match');
  });

  it('caller_id_match: no_match branch', () => {
    const graph = buildPlannerGraph({
      entry_node_id: 'cm',
      nodes: [{ id: 'cm', type: 'caller_id_match', prefixes: ['+90'], match_node_id: 'vip', no_match_node_id: 'gen' }],
    });
    const ctx = { ...emptyCtx, callerNumber: '+12125551234' };
    const { nextNodeId, edgeId } = resolveNextNode(graph.nodes.get('cm')!, ctx);
    expect(nextNodeId).toBe('gen');
    expect(edgeId).toBe('cm:no_match:gen');
  });

  it('business_hours: resolves in-hours branch via resolveBusinessHours', () => {
    const graph = buildPlannerGraph({
      entry_node_id: 'bh',
      nodes: [{ id: 'bh', type: 'business_hours', schedule_id: 's1', in_hours_node_id: 'open', out_of_hours_node_id: 'closed' }],
    });
    const ctx = { ...emptyCtx, resolveBusinessHours: (id: string) => id === 's1' ? true : undefined };
    const { nextNodeId, edgeId } = resolveNextNode(graph.nodes.get('bh')!, ctx);
    expect(nextNodeId).toBe('open');
    expect(edgeId).toBe('bh:in_hours:open');
  });

  it('business_hours: resolves out-of-hours branch', () => {
    const graph = buildPlannerGraph({
      entry_node_id: 'bh',
      nodes: [{ id: 'bh', type: 'business_hours', schedule_id: 's1', in_hours_node_id: 'open', out_of_hours_node_id: 'closed' }],
    });
    const ctx = { ...emptyCtx, resolveBusinessHours: () => false };
    const { nextNodeId, edgeId } = resolveNextNode(graph.nodes.get('bh')!, ctx);
    expect(nextNodeId).toBe('closed');
    expect(edgeId).toBe('bh:out_of_hours:closed');
  });

  it('business_hours: returns undefined when no resolveBusinessHours provided', () => {
    const graph = buildPlannerGraph({
      entry_node_id: 'bh',
      nodes: [{ id: 'bh', type: 'business_hours', schedule_id: 's1', in_hours_node_id: 'open', out_of_hours_node_id: 'closed' }],
    });
    const { nextNodeId } = resolveNextNode(graph.nodes.get('bh')!, emptyCtx);
    expect(nextNodeId).toBeUndefined();
  });

  it.each(['transfer_extension', 'queue', 'voicemail_drop', 'hangup'])(
    '%s: returns undefined nextNodeId (terminal node)',
    (type) => {
      const graph = buildPlannerGraph({ entry_node_id: 'n', nodes: [{ id: 'n', type }] });
      const { nextNodeId, edgeId } = resolveNextNode(graph.nodes.get('n')!, emptyCtx);
      expect(nextNodeId).toBeUndefined();
      expect(edgeId).toBeUndefined();
    },
  );
});

describe('resolveSwitchInput', () => {
  it('resolves {{last_digits}} from context', () => {
    const graph = buildPlannerGraph({ entry_node_id: 'sw', nodes: [{ id: 'sw', type: 'switch', input: '{{last_digits}}' }] });
    const node = graph.nodes.get('sw')!;
    expect(resolveSwitchInput(node, { ...emptyCtx, lastDigits: '3' })).toBe('3');
  });

  it('resolves {{caller_number}} from context', () => {
    const graph = buildPlannerGraph({ entry_node_id: 'sw', nodes: [{ id: 'sw', type: 'switch', input: '{{caller_number}}' }] });
    const node = graph.nodes.get('sw')!;
    expect(resolveSwitchInput(node, { ...emptyCtx, callerNumber: '+905551234567' })).toBe('+905551234567');
  });

  it('resolves {{now.hour}} from scenarioHour context', () => {
    const graph = buildPlannerGraph({ entry_node_id: 'sw', nodes: [{ id: 'sw', type: 'switch', input: '{{now.hour}}' }] });
    const node = graph.nodes.get('sw')!;
    expect(resolveSwitchInput(node, { ...emptyCtx, scenarioHour: '09' })).toBe('09');
  });

  it('resolves {{var.lang}} from variables context', () => {
    const graph = buildPlannerGraph({ entry_node_id: 'sw', nodes: [{ id: 'sw', type: 'switch', input: '{{var.lang}}' }] });
    const node = graph.nodes.get('sw')!;
    expect(resolveSwitchInput(node, { ...emptyCtx, variables: { lang: 'tr' } })).toBe('tr');
  });

  it('returns raw literal when input is not a template token', () => {
    const graph = buildPlannerGraph({ entry_node_id: 'sw', nodes: [{ id: 'sw', type: 'switch', input: 'static_value' }] });
    const node = graph.nodes.get('sw')!;
    expect(resolveSwitchInput(node, emptyCtx)).toBe('static_value');
  });

  it('defaults to {{last_digits}} when input is absent', () => {
    const graph = buildPlannerGraph({ entry_node_id: 'sw', nodes: [{ id: 'sw', type: 'switch' }] });
    const node = graph.nodes.get('sw')!;
    expect(resolveSwitchInput(node, { ...emptyCtx, lastDigits: '7' })).toBe('7');
  });
});

describe('edge ID format consistency with graphToBuilderEdges', () => {
  it('next edge ID matches graphToBuilderEdges format ${source}:next:${target}', () => {
    const graph = buildPlannerGraph({ entry_node_id: 's', nodes: [{ id: 's', type: 'start', next_node_id: 'n' }] });
    const { edgeId } = resolveNextNode(graph.nodes.get('s')!, emptyCtx);
    expect(edgeId).toBe('s:next:n');
  });

  it('switch case edge ID matches ${source}:case:${key}:${target}', () => {
    const graph = buildPlannerGraph({
      entry_node_id: 'sw',
      nodes: [{ id: 'sw', type: 'switch', cases: { '2': 'support' } }],
    });
    const { edgeId } = resolveNextNode(graph.nodes.get('sw')!, { ...emptyCtx, lastDigits: '2' });
    expect(edgeId).toBe('sw:case:2:support');
  });

  it('business_hours out_of_hours edge ID matches ${source}:out_of_hours:${target}', () => {
    const graph = buildPlannerGraph({
      entry_node_id: 'bh',
      nodes: [{ id: 'bh', type: 'business_hours', schedule_id: 's1', in_hours_node_id: 'open', out_of_hours_node_id: 'closed' }],
    });
    const { edgeId } = resolveNextNode(graph.nodes.get('bh')!, { ...emptyCtx, resolveBusinessHours: () => false });
    expect(edgeId).toBe('bh:out_of_hours:closed');
  });
});
