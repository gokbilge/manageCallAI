import { SimulationScenarioMcpSchema } from '@managecallai/contracts';
import { apiCall } from '../api-client.js';

export const IVR_FLOW_TOOLS = [
  {
    name: 'list_ivr_flows',
    description:
      'List all IVR flows for this tenant. Returns id, name, status, and version pointers.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_ivr_flow',
    description:
      'Get a single IVR flow with all its versions and the draft graph definition.',
    inputSchema: {
      type: 'object' as const,
      required: ['flow_id'],
      properties: {
        flow_id: { type: 'string', description: 'UUID of the IVR flow' },
      },
    },
  },
  {
    name: 'create_ivr_flow',
    description:
      'Create a new IVR flow with an empty or supplied graph definition. Returns the flow and its draft version.',
    inputSchema: {
      type: 'object' as const,
      required: ['name'],
      properties: {
        name:        { type: 'string', description: 'Display name for the flow' },
        description: { type: 'string', description: 'Optional description' },
        definition:  { type: 'object', description: 'Optional initial graph_json (nodes/edges)' },
      },
    },
  },
  {
    name: 'update_flow_definition',
    description:
      'Replace the graph definition of a draft flow version. Use this to iteratively build the IVR flow.',
    inputSchema: {
      type: 'object' as const,
      required: ['flow_id', 'version_id', 'definition'],
      properties: {
        flow_id:    { type: 'string', description: 'UUID of the IVR flow' },
        version_id: { type: 'string', description: 'UUID of the draft version to update' },
        definition: { type: 'object', description: 'New graph_json object (nodes/edges/entry_node_id)' },
      },
    },
  },
  {
    name: 'validate_flow',
    description:
      'Validate the current draft version of a flow. Returns passed/failed with errors and warnings.',
    inputSchema: {
      type: 'object' as const,
      required: ['flow_id'],
      properties: {
        flow_id: { type: 'string', description: 'UUID of the IVR flow' },
      },
    },
  },
  {
    name: 'simulate_flow',
    description:
      'Simulate the current draft version with a caller scenario. Returns the execution path and final action.',
    // inputSchema is derived from SimulationScenarioSchema in packages/contracts so
    // that adding a new scenario field automatically updates the MCP tool description.
    inputSchema: {
      type: 'object' as const,
      required: ['flow_id'],
      properties: {
        flow_id: { type: 'string', description: 'UUID of the IVR flow' },
        ...(SimulationScenarioMcpSchema['properties'] as Record<string, unknown> ?? {}),
      },
    },
  },
  {
    name: 'request_publish',
    description:
      'Submit a validated flow version for publish. Returns immediately as published, or pending_approval if the tenant policy requires a human to approve first.',
    inputSchema: {
      type: 'object' as const,
      required: ['flow_id', 'version_id'],
      properties: {
        flow_id:    { type: 'string', description: 'UUID of the IVR flow' },
        version_id: { type: 'string', description: 'UUID of the validated version to publish' },
      },
    },
  },
  {
    name: 'run_simulation_suite',
    description:
      'Run multiple simulation scenarios against the current draft of a flow in one call. Returns pass/fail and execution path for each scenario. Use this for regression checks before requesting publish.',
    inputSchema: {
      type: 'object' as const,
      required: ['flow_id', 'scenarios'],
      properties: {
        flow_id: { type: 'string', description: 'UUID of the IVR flow' },
        scenarios: {
          type: 'array',
          description: 'Array of simulation scenarios to run',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string', description: 'Human-readable name for this scenario' },
              caller_number: { type: 'string' },
              digits: { type: 'array', items: { type: 'string' } },
              now: { type: 'string', description: 'ISO 8601 datetime override' },
            },
          },
        },
      },
    },
  },
] as const;

type Args = Record<string, unknown>;

function ok(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function err(status: number, data: unknown): string {
  return `API error ${status}: ${JSON.stringify(data)}`;
}

export async function handleTool(name: string, args: Args): Promise<{ text: string; isError?: boolean }> {
  switch (name) {
    case 'list_ivr_flows': {
      const r = await apiCall<{ data: unknown[] }>('GET', '/api/v1/ivr-flows');
      if (!r.ok) return { text: err(r.status, r.data), isError: true };
      return { text: ok(r.data) };
    }

    case 'get_ivr_flow': {
      const r = await apiCall<{ data: unknown }>('GET', `/api/v1/ivr-flows/${args.flow_id}`);
      if (!r.ok) return { text: err(r.status, r.data), isError: true };
      return { text: ok(r.data) };
    }

    case 'create_ivr_flow': {
      const body: Record<string, unknown> = { name: args.name };
      if (args.description !== undefined) body.description = args.description;
      if (args.definition !== undefined) body.definition = args.definition;
      const r = await apiCall<{ data: unknown }>('POST', '/api/v1/ivr-flows', body);
      if (!r.ok) return { text: err(r.status, r.data), isError: true };
      return { text: ok(r.data) };
    }

    case 'update_flow_definition': {
      const r = await apiCall<{ data: unknown }>(
        'PATCH',
        `/api/v1/ivr-flows/${args.flow_id}/versions/${args.version_id}`,
        { definition: args.definition },
      );
      if (!r.ok) return { text: err(r.status, r.data), isError: true };
      return { text: ok(r.data) };
    }

    case 'validate_flow': {
      const r = await apiCall<{ data: unknown }>('POST', `/api/v1/ivr-flows/${args.flow_id}/validate`);
      if (!r.ok && r.status !== 422) return { text: err(r.status, r.data), isError: true };
      return { text: ok(r.data), isError: r.status === 422 };
    }

    case 'simulate_flow': {
      const body: Record<string, unknown> = {};
      if (args.caller_number !== undefined)       body.caller_number = args.caller_number;
      if (args.digits !== undefined)              body.digits = args.digits;
      if (args.collected_digits !== undefined)    body.collected_digits = args.collected_digits;
      if (args.now !== undefined)                 body.now = args.now;
      if (args.force_timeout !== undefined)       body.force_timeout = args.force_timeout;
      if (args.force_timeout_nodes !== undefined) body.force_timeout_nodes = args.force_timeout_nodes;
      if (args.force_invalid !== undefined)       body.force_invalid = args.force_invalid;
      if (args.force_invalid_nodes !== undefined) body.force_invalid_nodes = args.force_invalid_nodes;
      if (args.variables !== undefined)           body.variables = args.variables;
      const r = await apiCall<{ data: unknown }>('POST', `/api/v1/ivr-flows/${args.flow_id}/simulate`, body);
      if (!r.ok && r.status !== 422) return { text: err(r.status, r.data), isError: true };
      return { text: ok(r.data), isError: r.status === 422 };
    }

    case 'request_publish': {
      const r = await apiCall<{ data: unknown }>(
        'POST',
        `/api/v1/ivr-flows/${args.flow_id}/versions/${args.version_id}/publish`,
      );
      if (!r.ok) return { text: err(r.status, r.data), isError: true };
      return { text: ok(r.data) };
    }

    case 'run_simulation_suite': {
      const scenarios = Array.isArray(args.scenarios) ? args.scenarios as Args[] : [];
      const results: Array<{ label: string; status: string; path: unknown[]; final_action: unknown; errors: unknown[] }> = [];
      for (const scenario of scenarios) {
        const body: Record<string, unknown> = {};
        if (scenario.caller_number !== undefined) body.caller_number = scenario.caller_number;
        if (scenario.digits !== undefined)        body.digits = scenario.digits;
        if (scenario.now !== undefined)           body.now = scenario.now;
        const r = await apiCall<{ data: { outcome?: { status: string; path: unknown[]; final_action: unknown; errors: unknown[] } } }>(
          'POST',
          `/api/v1/ivr-flows/${args.flow_id}/simulate`,
          body,
        );
        const label = typeof scenario.label === 'string' ? scenario.label : `scenario_${results.length + 1}`;
        if (!r.ok && r.status !== 422) {
          results.push({ label, status: 'error', path: [], final_action: null, errors: [r.data] });
        } else {
          const outcome = (r.data as Record<string, unknown>)?.outcome as { status: string; path: unknown[]; final_action: unknown; errors: unknown[] } | undefined;
          results.push({
            label,
            status: outcome?.status ?? (r.ok ? 'passed' : 'failed'),
            path: outcome?.path ?? [],
            final_action: outcome?.final_action ?? null,
            errors: outcome?.errors ?? [],
          });
        }
      }
      const allPassed = results.every((r) => r.status === 'passed');
      return { text: ok({ suite_status: allPassed ? 'passed' : 'failed', results }), isError: !allPassed };
    }

    default:
      return { text: `Unknown tool: ${name}`, isError: true };
  }
}
