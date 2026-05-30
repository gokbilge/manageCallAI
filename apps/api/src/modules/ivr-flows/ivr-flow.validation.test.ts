import { describe, expect, it } from 'vitest';
import { computeReachableBranches, defaultIvrGraph, validateIvrGraph } from './ivr-flow.validation.js';

describe('validateIvrGraph', () => {
  it('passes a valid minimal graph', () => {
    const result = validateIvrGraph(defaultIvrGraph());
    expect(result.status).toBe('passed');
    expect(result.errors).toHaveLength(0);
  });

  it('fails when entry node is missing', () => {
    const result = validateIvrGraph({
      nodes: [{ id: 'end', type: 'hangup' }],
    });
    expect(result.status).toBe('failed');
    expect(result.errors.some((error) => error.field === 'graph_json.entry_node_id')).toBe(true);
  });

  it('fails on duplicate node ids', () => {
    const result = validateIvrGraph({
      entry_node_id: 'start',
      nodes: [
        { id: 'start', type: 'start', next_node_id: 'end' },
        { id: 'start', type: 'hangup' },
      ],
    });
    expect(result.status).toBe('failed');
    expect(result.errors.some((error) => error.message.includes('Duplicate node id'))).toBe(true);
  });

  it('fails on missing referenced node', () => {
    const result = validateIvrGraph({
      entry_node_id: 'start',
      nodes: [
        { id: 'start', type: 'start', next_node_id: 'missing' },
      ],
    });
    expect(result.status).toBe('failed');
    expect(result.errors.some((error) => error.message.includes('Referenced node does not exist'))).toBe(true);
  });

  it.each(['play', 'menu', 'transfer', 'condition'])(
    'rejects removed alias/future type "%s"',
    (type) => {
      const result = validateIvrGraph({
        entry_node_id: 'start',
        nodes: [
          { id: 'start', type: 'start', next_node_id: 'n' },
          { id: 'n', type },
        ],
      });
      expect(result.status).toBe('failed');
      expect(result.errors.some((e) => e.message.includes(`Unsupported node type: ${type}`))).toBe(true);
    },
  );

  it.each(['start', 'play_prompt', 'play_collect', 'switch', 'transfer_extension', 'hangup', 'business_hours', 'caller_id_match', 'set_variable', 'queue', 'voicemail_drop'])(
    'accepts supported node type "%s"',
    (type) => {
      const graph =
        type === 'start'
          ? { entry_node_id: 'start', nodes: [{ id: 'start', type: 'start', next_node_id: 'end' }, { id: 'end', type: 'hangup' }] }
          : type === 'caller_id_match'
            ? { entry_node_id: 'start', nodes: [{ id: 'start', type: 'start', next_node_id: 'n' }, { id: 'n', type, prefixes: ['+90'], match_node_id: 'end', no_match_node_id: 'end' }, { id: 'end', type: 'hangup' }] }
            : type === 'set_variable'
              ? { entry_node_id: 'start', nodes: [{ id: 'start', type: 'start', next_node_id: 'n' }, { id: 'n', type, variable_name: 'lang', value: 'tr', next_node_id: 'end' }, { id: 'end', type: 'hangup' }] }
              : type === 'queue'
                ? { entry_node_id: 'start', nodes: [{ id: 'start', type: 'start', next_node_id: 'n' }, { id: 'n', type, queue_id: 'queue-1' }] }
                : type === 'voicemail_drop'
                  ? { entry_node_id: 'start', nodes: [{ id: 'start', type: 'start', next_node_id: 'n' }, { id: 'n', type, voicemail_box_id: 'box-1' }] }
                  : type === 'business_hours'
                    ? { entry_node_id: 'start', nodes: [{ id: 'start', type: 'start', next_node_id: 'n' }, { id: 'n', type, schedule_id: 'sched-1', in_hours_node_id: 'end', out_of_hours_node_id: 'end' }, { id: 'end', type: 'hangup' }] }
                    : { entry_node_id: 'start', nodes: [{ id: 'start', type: 'start', next_node_id: 'n' }, { id: 'n', type }] };
      const result = validateIvrGraph(graph);
      expect(result.errors.some((e) => e.message.startsWith('Unsupported node type'))).toBe(false);
    },
  );

  it('fails caller_id_match with empty prefixes', () => {
    const result = validateIvrGraph({
      entry_node_id: 'start',
      nodes: [
        { id: 'start', type: 'start', next_node_id: 'match' },
        { id: 'match', type: 'caller_id_match', prefixes: [], match_node_id: 'end', no_match_node_id: 'end' },
        { id: 'end', type: 'hangup' },
      ],
    });
    expect(result.status).toBe('failed');
    expect(result.errors.some((e) => e.field.includes('prefixes'))).toBe(true);
  });

  it('fails caller_id_match with missing branch node references', () => {
    const result = validateIvrGraph({
      entry_node_id: 'start',
      nodes: [
        { id: 'start', type: 'start', next_node_id: 'match' },
        { id: 'match', type: 'caller_id_match', prefixes: ['+90'], match_node_id: 'nonexistent', no_match_node_id: 'end' },
        { id: 'end', type: 'hangup' },
      ],
    });
    expect(result.status).toBe('failed');
    expect(result.errors.some((e) => e.message.includes('nonexistent'))).toBe(true);
  });

  it('passes a valid caller_id_match node', () => {
    const result = validateIvrGraph({
      entry_node_id: 'start',
      nodes: [
        { id: 'start', type: 'start', next_node_id: 'match' },
        { id: 'match', type: 'caller_id_match', prefixes: ['+90', '+1'], match_node_id: 'transfer', no_match_node_id: 'end' },
        { id: 'transfer', type: 'transfer_extension', extension_id: 'ext-1' },
        { id: 'end', type: 'hangup' },
      ],
    });
    expect(result.errors.filter((e) => !e.message.startsWith('Node is currently unreachable'))).toHaveLength(0);
  });

  it('fails queue node without queue_id', () => {
    const result = validateIvrGraph({
      entry_node_id: 'start',
      nodes: [
        { id: 'start', type: 'start', next_node_id: 'queue' },
        { id: 'queue', type: 'queue' },
      ],
    });
    expect(result.status).toBe('failed');
    expect(result.errors.some((e) => e.field.includes('queue_id'))).toBe(true);
  });

  it('accepts valid fallback_node_id on any node type', () => {
    const result = validateIvrGraph({
      entry_node_id: 'start',
      nodes: [
        { id: 'start', type: 'start', next_node_id: 'play', fallback_node_id: 'end' },
        { id: 'play', type: 'play_prompt', prompt_id: 'p1', next_node_id: 'end' },
        { id: 'end', type: 'hangup' },
      ],
    });
    expect(result.status).toBe('passed');
  });

  it('fails when fallback_node_id references a missing node', () => {
    const result = validateIvrGraph({
      entry_node_id: 'start',
      nodes: [
        { id: 'start', type: 'start', next_node_id: 'end', fallback_node_id: 'nonexistent' },
        { id: 'end', type: 'hangup' },
      ],
    });
    expect(result.status).toBe('failed');
    expect(result.errors.some((e) => e.field.includes('fallback_node_id'))).toBe(true);
  });

  it('fails when max_retries is not a non-negative integer', () => {
    const result = validateIvrGraph({
      entry_node_id: 'start',
      nodes: [
        { id: 'start', type: 'start', next_node_id: 'collect', max_retries: -1 },
        { id: 'collect', type: 'play_collect', next_node_id: 'end' },
        { id: 'end', type: 'hangup' },
      ],
    });
    expect(result.status).toBe('failed');
    expect(result.errors.some((e) => e.field.includes('max_retries'))).toBe(true);
  });

  it('detects deep traversal that exceeds the loop detection limit', () => {
    // Create a chain of 60 set_variable nodes to exceed MAX_TRAVERSAL_DEPTH=50
    const nodes: Array<Record<string, unknown>> = [{ id: 'start', type: 'start', next_node_id: 'n0' }];
    for (let i = 0; i < 55; i++) {
      nodes.push({
        id: `n${i}`,
        type: 'set_variable',
        variable_name: 'x',
        value: `${i}`,
        next_node_id: `n${i + 1}`,
      });
    }
    nodes.push({ id: 'n55', type: 'hangup' });
    const result = validateIvrGraph({ entry_node_id: 'start', nodes });
    expect(result.errors.some((e) => e.message.includes('loop'))).toBe(true);
  });

  it('warns when play_prompt node has no prompt_id or prompt_uri', () => {
    const result = validateIvrGraph({
      entry_node_id: 'start',
      nodes: [
        { id: 'start', type: 'start', next_node_id: 'play' },
        { id: 'play', type: 'play_prompt', next_node_id: 'end' },
        { id: 'end', type: 'hangup' },
      ],
    });
    expect(result.status).toBe('passed');
    expect(result.warnings.some((w) => w.message.includes('silence'))).toBe(true);
  });
});

describe('computeReachableBranches', () => {
  it('returns all node ids from the graph', () => {
    const graph = defaultIvrGraph();
    const ids = computeReachableBranches(graph);
    expect(ids.has('start')).toBe(true);
    expect(ids.has('end')).toBe(true);
    expect(ids.size).toBe(2);
  });

  it('returns empty set for invalid graph', () => {
    const ids = computeReachableBranches(null);
    expect(ids.size).toBe(0);
  });
});
