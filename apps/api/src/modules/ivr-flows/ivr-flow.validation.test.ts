import { describe, expect, it } from 'vitest';
import { defaultIvrGraph, validateIvrGraph } from './ivr-flow.validation.js';

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

  it.each(['play', 'menu', 'transfer', 'condition', 'queue'])(
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

  it.each(['start', 'play_prompt', 'play_collect', 'switch', 'transfer_extension', 'hangup'])(
    'accepts MVP node type "%s"',
    (type) => {
      const graph =
        type === 'start'
          ? { entry_node_id: 'start', nodes: [{ id: 'start', type: 'start', next_node_id: 'end' }, { id: 'end', type: 'hangup' }] }
          : { entry_node_id: 'start', nodes: [{ id: 'start', type: 'start', next_node_id: 'n' }, { id: 'n', type }] };
      const result = validateIvrGraph(graph);
      expect(result.errors.some((e) => e.message.startsWith('Unsupported node type'))).toBe(false);
    },
  );
});
