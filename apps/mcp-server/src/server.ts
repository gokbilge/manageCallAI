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
  { name: 'managecallai-mcp-server', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    // ── Extensions ──────────────────────────────────────────────────────────
    {
      name: 'list_extensions',
      description: 'List extensions for the authenticated tenant.',
      inputSchema: {
        type: 'object',
        required: ['access_token'],
        properties: { access_token: { type: 'string' } },
      },
    },
    {
      name: 'get_extension',
      description: 'Fetch a single extension by id.',
      inputSchema: {
        type: 'object',
        required: ['id', 'access_token'],
        properties: { id: { type: 'string' }, access_token: { type: 'string' } },
      },
    },
    {
      name: 'list_call_events',
      description: 'List normalized call events for a tenant.',
      inputSchema: {
        type: 'object',
        required: ['access_token'],
        properties: { tenant_id: { type: 'string' }, access_token: { type: 'string' } },
      },
    },
    // ── IVR Flows — read ─────────────────────────────────────────────────────
    {
      name: 'list_ivr_flows',
      description: 'List all IVR flows for the tenant.',
      inputSchema: {
        type: 'object',
        required: ['access_token'],
        properties: { access_token: { type: 'string' } },
      },
    },
    {
      name: 'get_ivr_flow',
      description: 'Fetch an IVR flow with all versions by id.',
      inputSchema: {
        type: 'object',
        required: ['flow_id', 'access_token'],
        properties: { flow_id: { type: 'string' }, access_token: { type: 'string' } },
      },
    },
    {
      name: 'explain_ivr_flow',
      description: 'Return a human-readable summary of an IVR flow\'s current draft graph without mutating any state.',
      inputSchema: {
        type: 'object',
        required: ['flow_id', 'access_token'],
        properties: { flow_id: { type: 'string' }, access_token: { type: 'string' } },
      },
    },
    // ── IVR Flows — draft mutations ──────────────────────────────────────────
    {
      name: 'create_ivr_flow_draft',
      description: 'Create a new IVR flow with an initial draft version. Returns the flow with its first version.',
      inputSchema: {
        type: 'object',
        required: ['name', 'access_token'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          access_token: { type: 'string' },
        },
      },
    },
    {
      name: 'add_ivr_node',
      description: 'Append a node to the draft version\'s graph_json.nodes array. Supported types: play, menu, switch, transfer_extension, hangup.',
      inputSchema: {
        type: 'object',
        required: ['flow_id', 'version_id', 'node', 'access_token'],
        properties: {
          flow_id: { type: 'string' },
          version_id: { type: 'string' },
          node: {
            type: 'object',
            description: 'Node object with at minimum { id, type }.',
            additionalProperties: true,
          },
          access_token: { type: 'string' },
        },
      },
    },
    {
      name: 'connect_ivr_nodes',
      description: 'Set next_node_id on a source node in the draft version to point to a target node. Use this to wire the graph after adding nodes.',
      inputSchema: {
        type: 'object',
        required: ['flow_id', 'version_id', 'source_node_id', 'target_node_id', 'access_token'],
        properties: {
          flow_id: { type: 'string' },
          version_id: { type: 'string' },
          source_node_id: { type: 'string' },
          target_node_id: { type: 'string' },
          edge_key: {
            type: 'string',
            description: 'For switch/menu nodes: the cases key or "default" to set default_node_id.',
          },
          access_token: { type: 'string' },
        },
      },
    },
    // ── IVR Flows — lifecycle ────────────────────────────────────────────────
    {
      name: 'validate_ivr_flow',
      description: 'Run structural validation on the current draft version. Returns pass/fail and any errors.',
      inputSchema: {
        type: 'object',
        required: ['flow_id', 'access_token'],
        properties: { flow_id: { type: 'string' }, access_token: { type: 'string' } },
      },
    },
    {
      name: 'simulate_ivr_flow',
      description: 'Simulate the current draft with a sample scenario and return the traversal path and final action.',
      inputSchema: {
        type: 'object',
        required: ['flow_id', 'access_token'],
        properties: {
          flow_id: { type: 'string' },
          digits: { type: 'array', items: { type: 'string' } },
          caller_number: { type: 'string' },
          now: { type: 'string', description: 'ISO-8601 timestamp used for time-of-day conditions.' },
          access_token: { type: 'string' },
        },
      },
    },
    {
      name: 'request_publish_ivr_flow',
      description: 'Request publication of a specific validated/simulated version. May return pending_approval if tenant policy requires it.',
      inputSchema: {
        type: 'object',
        required: ['flow_id', 'version_id', 'access_token'],
        properties: {
          flow_id: { type: 'string' },
          version_id: { type: 'string' },
          access_token: { type: 'string' },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const args = (request.params.arguments ?? {}) as Record<string, unknown>;
  const tok = (): string => {
    const t = args['access_token'];
    if (typeof t !== 'string' || !t) throw new Error('access_token is required');
    return t;
  };
  const str = (key: string): string => {
    const v = args[key];
    if (typeof v !== 'string' || !v) throw new Error(`${key} is required`);
    return v;
  };

  switch (request.params.name) {
    // ── Extensions ──────────────────────────────────────────────────────────
    case 'list_extensions': {
      const data = await fetchJson<ApiCollection<unknown>>('/api/v1/extensions', tok());
      return { content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }] };
    }
    case 'get_extension': {
      const data = await fetchJson<ApiSingle<unknown>>(
        `/api/v1/extensions/${encodeURIComponent(str('id'))}`,
        tok(),
      );
      return { content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }] };
    }
    case 'list_call_events': {
      const tenantId = args['tenant_id'];
      const query = typeof tenantId === 'string' && tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
      const data = await fetchJson<ApiCollection<unknown>>(`/api/v1/call-events${query}`, tok());
      return { content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }] };
    }

    // ── IVR Flows — read ─────────────────────────────────────────────────────
    case 'list_ivr_flows': {
      const data = await fetchJson<ApiCollection<IvrFlow>>('/api/v1/ivr-flows', tok());
      return { content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }] };
    }
    case 'get_ivr_flow': {
      const data = await fetchJson<ApiSingle<IvrFlowWithVersions>>(
        `/api/v1/ivr-flows/${encodeURIComponent(str('flow_id'))}`,
        tok(),
      );
      return { content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }] };
    }
    case 'explain_ivr_flow': {
      const data = await fetchJson<ApiSingle<IvrFlowWithVersions>>(
        `/api/v1/ivr-flows/${encodeURIComponent(str('flow_id'))}`,
        tok(),
      );
      const flow = data.data;
      const draft = flow.versions.find((v) => v.id === flow.draft_version_id) ?? flow.versions[0];
      const nodes = Array.isArray(draft?.graph_json?.nodes) ? draft.graph_json.nodes as Array<Record<string, unknown>> : [];
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
        lines.push(`  [${id}] type=${type}${next}`);
      }
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }

    // ── IVR Flows — draft mutations ──────────────────────────────────────────
    case 'create_ivr_flow_draft': {
      const created = await postJson<ApiSingle<IvrFlowWithVersions>>('/api/v1/ivr-flows', tok(), {
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
        tok(),
      );
      const version = current.data.versions.find((v) => v.id === versionId);
      if (!version) throw new Error(`Version ${versionId} not found on flow ${flowId}`);

      const existingNodes = Array.isArray(version.graph_json.nodes) ? version.graph_json.nodes : [];
      const updatedGraph = {
        ...version.graph_json,
        nodes: [...existingNodes, newNode],
      };

      const updated = await patchJson<ApiSingle<unknown>>(
        `/api/v1/ivr-flows/${encodeURIComponent(flowId)}/versions/${encodeURIComponent(versionId)}`,
        tok(),
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
        tok(),
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
            if (edgeKey === 'default') {
              return { ...n, default_node_id: targetId };
            }
            return { ...n, next_node_id: targetId };
          })
        : [];

      const updated = await patchJson<ApiSingle<unknown>>(
        `/api/v1/ivr-flows/${encodeURIComponent(flowId)}/versions/${encodeURIComponent(versionId)}`,
        tok(),
        { graph_json: { ...version.graph_json, nodes } },
      );
      return { content: [{ type: 'text', text: JSON.stringify(updated.data, null, 2) }] };
    }

    // ── IVR Flows — lifecycle ────────────────────────────────────────────────
    case 'validate_ivr_flow': {
      const data = await postJson<{ data: { outcome: { status: string; errors: unknown[] } } }>(
        `/api/v1/ivr-flows/${encodeURIComponent(str('flow_id'))}/validate`,
        tok(),
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
        tok(),
        scenario,
      );
      return { content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }] };
    }
    case 'request_publish_ivr_flow': {
      const flowId = str('flow_id');
      const versionId = str('version_id');
      const data = await postJson<{ data: unknown }>(
        `/api/v1/ivr-flows/${encodeURIComponent(flowId)}/versions/${encodeURIComponent(versionId)}/publish`,
        tok(),
      );
      return { content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }] };
    }

    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
