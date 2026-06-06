import { describe, it, expect } from 'vitest';

// ── Inline the diff logic for unit testing ────────────────────────────────────
// (mirrors applyIvrDiff from ivr-ai-generation.controller.ts)

function applyIvrDiff(
  base: Record<string, unknown>,
  diff: Record<string, unknown>,
): Record<string, unknown> {
  const nodes = Array.isArray(base.nodes) ? [...(base.nodes as Record<string, unknown>[])] : [];
  const edges = Array.isArray(base.edges) ? [...(base.edges as Record<string, unknown>[])] : [];

  const nodesDiff = diff.nodes as Record<string, unknown[]> | undefined;
  const edgesDiff = diff.edges as Record<string, unknown[]> | undefined;

  if (nodesDiff) {
    const toAdd = (nodesDiff.add ?? []) as Record<string, unknown>[];
    const toRemove = new Set((nodesDiff.remove ?? []) as string[]);
    const toModify = ((nodesDiff.modify ?? []) as Array<{ id: string; patch: Record<string, unknown> }>);

    const filtered = nodes.filter((n) => !toRemove.has(String(n.id)));
    const modifiedMap = new Map(toModify.map((m) => [m.id, m.patch]));
    const patched = filtered.map((n) => {
      const patch = modifiedMap.get(String(n.id));
      return patch ? { ...n, ...patch } : n;
    });
    nodes.splice(0, nodes.length, ...patched, ...toAdd);
  }

  if (edgesDiff) {
    const toAdd = (edgesDiff.add ?? []) as Record<string, unknown>[];
    const toRemove = new Set((edgesDiff.remove ?? []) as string[]);
    const toModify = ((edgesDiff.modify ?? []) as Array<{ id: string; patch: Record<string, unknown> }>);

    const filtered = edges.filter((e) => !toRemove.has(String(e.id)));
    const modifiedMap = new Map(toModify.map((m) => [m.id, m.patch]));
    const patched = filtered.map((e) => {
      const patch = modifiedMap.get(String(e.id));
      return patch ? { ...e, ...patch } : e;
    });
    edges.splice(0, edges.length, ...patched, ...toAdd);
  }

  return { ...base, nodes, edges };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

const baseGraph = {
  nodes: [
    { id: 'start', type: 'start' },
    { id: 'menu', type: 'play_collect', prompt_id: 'p1', max_digits: 1 },
    { id: 'sales', type: 'transfer_extension', extension_id: 'ext-1' },
  ],
  edges: [
    { id: 'e1', from: 'start', to: 'menu' },
    { id: 'e2', from: 'menu', to: 'sales', condition: '1' },
  ],
};

describe('applyIvrDiff', () => {
  it('adds new nodes', () => {
    const diff = {
      nodes: {
        add: [{ id: 'support', type: 'transfer_extension', extension_id: 'ext-2' }],
        remove: [],
        modify: [],
      },
    };
    const result = applyIvrDiff(baseGraph, diff);
    const ids = (result.nodes as Record<string, unknown>[]).map((n) => n.id);
    expect(ids).toContain('support');
    expect(ids).toHaveLength(4);
  });

  it('removes nodes by id', () => {
    const diff = {
      nodes: { add: [], remove: ['sales'], modify: [] },
    };
    const result = applyIvrDiff(baseGraph, diff);
    const ids = (result.nodes as Record<string, unknown>[]).map((n) => n.id);
    expect(ids).not.toContain('sales');
    expect(ids).toHaveLength(2);
  });

  it('modifies node fields', () => {
    const diff = {
      nodes: {
        add: [],
        remove: [],
        modify: [{ id: 'menu', patch: { max_digits: 2, prompt_id: 'p2' } }],
      },
    };
    const result = applyIvrDiff(baseGraph, diff);
    const menu = (result.nodes as Record<string, unknown>[]).find((n) => n.id === 'menu');
    expect(menu?.max_digits).toBe(2);
    expect(menu?.prompt_id).toBe('p2');
  });

  it('adds new edges', () => {
    const diff = {
      edges: {
        add: [{ id: 'e3', from: 'menu', to: 'support', condition: '2' }],
        remove: [],
        modify: [],
      },
    };
    const result = applyIvrDiff(baseGraph, diff);
    const eids = (result.edges as Record<string, unknown>[]).map((e) => e.id);
    expect(eids).toContain('e3');
    expect(eids).toHaveLength(3);
  });

  it('removes edges by id', () => {
    const diff = {
      edges: { add: [], remove: ['e2'], modify: [] },
    };
    const result = applyIvrDiff(baseGraph, diff);
    const eids = (result.edges as Record<string, unknown>[]).map((e) => e.id);
    expect(eids).not.toContain('e2');
  });

  it('modifies edge conditions', () => {
    const diff = {
      edges: {
        add: [],
        remove: [],
        modify: [{ id: 'e2', patch: { condition: '9' } }],
      },
    };
    const result = applyIvrDiff(baseGraph, diff);
    const e2 = (result.edges as Record<string, unknown>[]).find((e) => e.id === 'e2');
    expect(e2?.condition).toBe('9');
  });

  it('applies combined add/remove/modify across nodes and edges', () => {
    const diff = {
      nodes: {
        add: [{ id: 'vip', type: 'caller_id_match', prefixes: ['+1800'] }],
        remove: ['sales'],
        modify: [{ id: 'menu', patch: { max_digits: 2 } }],
      },
      edges: {
        add: [{ id: 'e3', from: 'menu', to: 'vip', condition: '3' }],
        remove: ['e2'],
        modify: [],
      },
    };
    const result = applyIvrDiff(baseGraph, diff);
    const nodeIds = (result.nodes as Record<string, unknown>[]).map((n) => n.id);
    const edgeIds = (result.edges as Record<string, unknown>[]).map((e) => e.id);

    expect(nodeIds).toContain('vip');
    expect(nodeIds).not.toContain('sales');
    expect(edgeIds).toContain('e3');
    expect(edgeIds).not.toContain('e2');
  });

  it('preserves other graph properties', () => {
    const graphWithMeta = { ...baseGraph, meta: { version: '1' } };
    const result = applyIvrDiff(graphWithMeta, {});
    expect(result.meta).toEqual({ version: '1' });
  });

  it('handles empty base graph gracefully', () => {
    const result = applyIvrDiff({}, {
      nodes: { add: [{ id: 'start', type: 'start' }], remove: [], modify: [] },
    });
    expect((result.nodes as Record<string, unknown>[]).length).toBe(1);
  });
});
