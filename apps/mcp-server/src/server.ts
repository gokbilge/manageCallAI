/**
 * DEPRECATION NOTICE
 *
 * apps/mcp-server is a legacy prototype retained for Docker image compatibility.
 * The canonical MCP server is apps/mcp. No new tools should be added here.
 *
 * What changed (SLICE-41):
 * - access_token is no longer passed as a tool argument. Authentication uses
 *   MANAGECALL_API_KEY from the environment (set via MCP server config).
 * - tool inputSchemas no longer include access_token properties.
 * - All API calls use the env-configured API key.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { fetchJson, patchJson, postJson } from './api/client.js';

type ApiCollection<T> = { data: T[] };
type ApiSingle<T> = { data: T };

type IvrFlow = {
  id: string;
  name: string;
  status: string;
  description?: string;
  draft_version_id: string | null;
  active_version_id: string | null;
};

type IvrFlowWithVersions = IvrFlow & {
  versions: Array<{
    id: string;
    version_number: number;
    state: string;
    graph_json: Record<string, unknown>;
    validated_at: string | null;
    simulated_at: string | null;
    published_at: string | null;
  }>;
};

const server = new Server(
  { name: 'managecallai-mcp-server', version: '0.2.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    // ── Extensions ──────────────────────────────────────────────────────────
    {
      name: 'list_extensions',
      description: 'List extensions for the authenticated tenant. Auth uses server-configured API key.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'get_extension',
      description: 'Fetch a single extension by id.',
      inputSchema: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
    {
      name: 'list_call_events',
      description: 'List normalized call events for the authenticated tenant.',
      inputSchema: { type: 'object', properties: {} },
    },
    // ── IVR Flows — read ─────────────────────────────────────────────────────
    {
      name: 'list_ivr_flows',
      description: 'List all IVR flows for the tenant.',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'get_ivr_flow',
      description: 'Fetch an IVR flow with all versions by id.',
      inputSchema: {
        type: 'object',
        required: ['flow_id'],
        properties: { flow_id: { type: 'string' } },
      },
    },
    {
      name: 'explain_ivr_flow',
      description: "Return a human-readable summary of an IVR flow's current draft graph without mutating any state.",
      inputSchema: {
        type: 'object',
        required: ['flow_id'],
        properties: { flow_id: { type: 'string' } },
      },
    },
    // ── IVR Flows — draft mutations ──────────────────────────────────────────
    {
      name: 'create_ivr_flow_draft',
      description: 'Create a new IVR flow with an initial draft version. Returns the flow with its first version.',
      inputSchema: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
    {
      name: 'add_ivr_node',
      description:
        "Append a node to the draft version's graph_json.nodes array. " +
        "Supported types: start, play_prompt, play_collect, switch, transfer_extension, " +
        "hangup, business_hours, caller_id_match, set_variable, queue, voicemail_drop. " +
        "Optional: fallback_node_id (node to go to on runtime failure), max_retries (integer).",
      inputSchema: {
        type: 'object',
        required: ['flow_id', 'version_id', 'node'],
        properties: {
          flow_id: { type: 'string' },
          version_id: { type: 'string' },
          node: {
            type: 'object',
            description: 'Node object with at minimum { id, type }. May include fallback_node_id and max_retries.',
            additionalProperties: true,
          },
        },
      },
    },
    {
      name: 'connect_ivr_nodes',
      description: 'Set next_node_id on a source node in the draft version to point to a target node.',
      inputSchema: {
        type: 'object',
        required: ['flow_id', 'version_id', 'source_node_id', 'target_node_id'],
        properties: {
          flow_id: { type: 'string' },
          version_id: { type: 'string' },
          source_node_id: { type: 'string' },
          target_node_id: { type: 'string' },
          edge_key: {
            type: 'string',
            description: 'For switch/menu nodes: the cases key or "default" to set default_node_id.',
          },
        },
      },
    },
    // ── IVR Flows — lifecycle ────────────────────────────────────────────────
    {
      name: 'validate_ivr_flow',
      description: 'Run structural validation on the current draft version. Returns pass/fail and any errors.',
      inputSchema: {
        type: 'object',
        required: ['flow_id'],
        properties: { flow_id: { type: 'string' } },
      },
    },
    {
      name: 'simulate_ivr_flow',
      description: 'Simulate the current draft with a sample scenario and return the traversal path and final action.',
      inputSchema: {
        type: 'object',
        required: ['flow_id'],
        properties: {
          flow_id: { type: 'string' },
          digits: { type: 'array', items: { type: 'string' } },
          caller_number: { type: 'string' },
          now: { type: 'string', description: 'ISO-8601 timestamp used for time-of-day conditions.' },
        },
      },
    },
    {
      name: 'request_publish_ivr_flow',
      description:
        'Request publication of a specific validated/simulated version. ' +
        'May return pending_approval if tenant policy requires human approval.',
      inputSchema: {
        type: 'object',
        required: ['flow_id', 'version_id'],
        properties: {
          flow_id: { type: 'string' },
          version_id: { type: 'string' },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const args = (request.params.arguments ?? {}) as Record<string, unknown>;
  const str = (key: string): string => {
    const v = args[key];
    if (typeof v !== 'string' || !v) throw new Error(`${key} is required`);
    return v;
  };

  switch (request.params.name) {
    // ── Extensions ──────────────────────────────────────────────────────────
    case 'list_extensions': {
      const data = await fetchJson<ApiCollection<unknown>>('/api/v1/extensions');
      return { content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }] };
    }
    case 'get_extension': {
      const data = await fetchJson<ApiSingle<unknown>>(
        `/api/v1/extensions/${encodeURIComponent(str('id'))}`,
      );
      return { content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }] };
    }
    case 'list_call_events': {
      const data = await fetchJson<ApiCollection<unknown>>('/api/v1/call-events');
      return { content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }] };
    }

    // ── IVR Flows — read ─────────────────────────────────────────────────────
    case 'list_ivr_flows': {
      const data = await fetchJson<ApiCollection<IvrFlow>>('/api/v1/ivr-flows');
      return { content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }] };
    }
    case 'get_ivr_flow': {
      const data = await fetchJson<ApiSingle<IvrFlowWithVersions>>(
        `/api/v1/ivr-flows/${encodeURIComponent(str('flow_id'))}`,
      );
      return { content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }] };
    }
    case 'explain_ivr_flow': {
      const data = await fetchJson<ApiSingle<IvrFlowWithVersions>>(
        `/api/v1/ivr-flows/${encodeURIComponent(str('flow_id'))}`,
      );
      const flow = data.data;
      const draft = flow.versions.find((v) => v.id === flow.draft_version_id) ?? flow.versions[0];
      const nodes = Array.isArray(draft?.graph_json?.nodes)
        ? (draft.graph_json.nodes as Array<Record<string, unknown>>)
        : [];
      const lines: string[] = [
        `IVR Flow: ${flow.name}`,
        `Status: ${flow.status}`,
        `Description: ${flow.description ?? 'none'}`,
        `Draft version: ${flow.draft_version_id ?? 'none'}`,
        `Active version: ${flow.active_version_id ?? 'none'}`,
        '',
        `Draft graph — ${nodes.length} node(s):`,
      ];
      for (const node of nodes) {
        const id = String(node['id'] ?? '?');
        const type = String(node['type'] ?? '?');
        const next = node['next_node_id'] ? ` → ${String(node['next_node_id'])}` : '';
        const fallback = node['fallback_node_id'] ? ` [fallback→${String(node['fallback_node_id'])}]` : '';
        lines.push(`  [${id}] type=${type}${next}${fallback}`);
      }
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }

    // ── IVR Flows — draft mutations ──────────────────────────────────────────
    case 'create_ivr_flow_draft': {
      const created = await postJson<ApiSingle<IvrFlowWithVersions>>('/api/v1/ivr-flows', {
        name: str('name'),
        description: args['description'] ?? undefined,
      });
      return { content: [{ type: 'text', text: JSON.stringify(created.data, null, 2) }] };
    }
    case 'add_ivr_node': {
      const flowId = str('flow_id');
      const versionId = str('version_id');
      const newNode = args['node'];
      if (typeof newNode !== 'object' || newNode === null || Array.isArray(newNode)) {
        throw new Error('node must be an object');
      }

      const current = await fetchJson<ApiSingle<IvrFlowWithVersions>>(
        `/api/v1/ivr-flows/${encodeURIComponent(flowId)}`,
      );
      const version = current.data.versions.find((v) => v.id === versionId);
      if (!version) throw new Error(`Version ${versionId} not found on flow ${flowId}`);

      const existingNodes = Array.isArray(version.graph_json.nodes) ? version.graph_json.nodes : [];
      const updatedGraph = { ...version.graph_json, nodes: [...existingNodes, newNode] };

      const updated = await patchJson<ApiSingle<unknown>>(
        `/api/v1/ivr-flows/${encodeURIComponent(flowId)}/versions/${encodeURIComponent(versionId)}`,
        { graph_json: updatedGraph },
      );
      return { content: [{ type: 'text', text: JSON.stringify(updated.data, null, 2) }] };
    }
    case 'connect_ivr_nodes': {
      const flowId = str('flow_id');
      const versionId = str('version_id');
      const sourceId = str('source_node_id');
      const targetId = str('target_node_id');
      const edgeKey = typeof args['edge_key'] === 'string' ? args['edge_key'] : undefined;

      const current = await fetchJson<ApiSingle<IvrFlowWithVersions>>(
        `/api/v1/ivr-flows/${encodeURIComponent(flowId)}`,
      );
      const version = current.data.versions.find((v) => v.id === versionId);
      if (!version) throw new Error(`Version ${versionId} not found on flow ${flowId}`);

      const nodes = Array.isArray(version.graph_json.nodes)
        ? (version.graph_json.nodes as Array<Record<string, unknown>>).map((n) => {
            if (n['id'] !== sourceId) return n;
            if (edgeKey && edgeKey !== 'default') {
              const cases = (typeof n['cases'] === 'object' && n['cases'] !== null ? n['cases'] : {}) as Record<string, unknown>;
              return { ...n, cases: { ...cases, [edgeKey]: targetId } };
            }
            if (edgeKey === 'default') return { ...n, default_node_id: targetId };
            return { ...n, next_node_id: targetId };
          })
        : [];

      const updated = await patchJson<ApiSingle<unknown>>(
        `/api/v1/ivr-flows/${encodeURIComponent(flowId)}/versions/${encodeURIComponent(versionId)}`,
        { graph_json: { ...version.graph_json, nodes } },
      );
      return { content: [{ type: 'text', text: JSON.stringify(updated.data, null, 2) }] };
    }

    // ── IVR Flows — lifecycle ────────────────────────────────────────────────
    case 'validate_ivr_flow': {
      const data = await postJson<{ data: { outcome: { status: string; errors: unknown[] } } }>(
        `/api/v1/ivr-flows/${encodeURIComponent(str('flow_id'))}/validate`,
      );
      return { content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }] };
    }
    case 'simulate_ivr_flow': {
      const scenario = {
        digits: Array.isArray(args['digits']) ? args['digits'] : ['1'],
        caller_number: typeof args['caller_number'] === 'string' ? args['caller_number'] : '+10000000000',
        now: typeof args['now'] === 'string' ? args['now'] : new Date().toISOString(),
      };
      const data = await postJson<{ data: { outcome: { status: string; path: string[]; final_action: unknown } } }>(
        `/api/v1/ivr-flows/${encodeURIComponent(str('flow_id'))}/simulate`,
        scenario,
      );
      return { content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }] };
    }
    case 'request_publish_ivr_flow': {
      const flowId = str('flow_id');
      const versionId = str('version_id');
      const data = await postJson<{ data: unknown }>(
        `/api/v1/ivr-flows/${encodeURIComponent(flowId)}/versions/${encodeURIComponent(versionId)}/publish`,
      );
      return { content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }] };
    }

    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
