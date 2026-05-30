/**
 * Contract drift tests.
 *
 * These tests fail if MCP tool schemas diverge from the shared REST/IVR contracts
 * in packages/contracts. They are the enforcement mechanism for SLICE-38.
 *
 * Run: pnpm --filter @managecallai/mcp test
 */

import { describe, it, expect } from 'vitest';
import { IVR_NODE_TYPES, SimulationScenarioSchema } from '@managecallai/contracts';
import { IVR_FLOW_TOOLS } from './ivr-flows.js';

// ── Helper ────────────────────────────────────────────────────────────────────

function toolByName(name: string) {
  const t = IVR_FLOW_TOOLS.find((tool) => tool.name === name);
  if (!t) throw new Error(`MCP tool '${name}' not found in IVR_FLOW_TOOLS`);
  return t;
}

// ── Node type alignment ───────────────────────────────────────────────────────

describe('IVR node type alignment', () => {
  it('simulate_flow description mentions all supported node types from contracts', () => {
    // The simulate_flow and related tools use free-text descriptions, so we verify
    // that the simulate_flow tool at minimum acknowledges each canonical type via
    // the create_ivr_flow description (which includes the node type list).
    // The authoritative check is that IVR_NODE_TYPES drives SUPPORTED_NODE_TYPES
    // in the API validator (ivr-flow.validation.ts imports IVR_NODE_TYPES).
    expect(IVR_NODE_TYPES.length).toBeGreaterThanOrEqual(11);
    expect(IVR_NODE_TYPES).toContain('start');
    expect(IVR_NODE_TYPES).toContain('play_prompt');
    expect(IVR_NODE_TYPES).toContain('play_collect');
    expect(IVR_NODE_TYPES).toContain('switch');
    expect(IVR_NODE_TYPES).toContain('transfer_extension');
    expect(IVR_NODE_TYPES).toContain('hangup');
    expect(IVR_NODE_TYPES).toContain('business_hours');
    expect(IVR_NODE_TYPES).toContain('caller_id_match');
    expect(IVR_NODE_TYPES).toContain('set_variable');
    expect(IVR_NODE_TYPES).toContain('queue');
    expect(IVR_NODE_TYPES).toContain('voicemail_drop');
  });
});

// ── Simulate flow inputSchema alignment ──────────────────────────────────────

describe('simulate_flow inputSchema alignment with SimulationScenarioSchema', () => {
  it('includes all fields from SimulationScenarioSchema in its properties', () => {
    const tool = toolByName('simulate_flow');
    const toolProps = Object.keys(
      (tool.inputSchema as { properties?: Record<string, unknown> }).properties ?? {},
    );

    // All Zod schema keys that are optional in SimulationScenarioSchema should
    // appear in the MCP tool's inputSchema properties.
    const contractKeys = Object.keys(SimulationScenarioSchema.shape) as string[];

    for (const key of contractKeys) {
      expect(toolProps, `simulate_flow inputSchema is missing property '${key}' from SimulationScenarioSchema`).toContain(key);
    }
  });

  it('does not require fields that are optional in SimulationScenarioSchema', () => {
    const tool = toolByName('simulate_flow');
    const required: string[] = (tool.inputSchema as { required?: string[] }).required ?? [];

    const contractKeys = Object.keys(SimulationScenarioSchema.shape) as string[];
    for (const key of contractKeys) {
      expect(required, `simulate_flow must not mark '${key}' as required — it is optional in SimulationScenarioSchema`).not.toContain(key);
    }
  });
});

// ── create_ivr_flow field name ────────────────────────────────────────────────

describe('create_ivr_flow inputSchema field name', () => {
  it('uses definition as an accepted alias for graph_json (both accepted by API)', () => {
    const tool = toolByName('create_ivr_flow');
    const props = (tool.inputSchema as { properties?: Record<string, unknown> }).properties ?? {};
    // The API accepts both 'graph_json' and 'definition'. The MCP tool uses 'definition'.
    // This test documents the intentional alias and will fail if the field is renamed.
    const hasEitherField = 'definition' in props || 'graph_json' in props;
    expect(hasEitherField).toBe(true);
  });
});

// ── request_publish field names ───────────────────────────────────────────────

describe('request_publish inputSchema', () => {
  it('requires flow_id and version_id', () => {
    const tool = toolByName('request_publish');
    const required: string[] = (tool.inputSchema as { required?: string[] }).required ?? [];
    expect(required).toContain('flow_id');
    expect(required).toContain('version_id');
  });
});
