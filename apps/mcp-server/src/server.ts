import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { fetchJson } from './api/client.js';

type ApiCollection<T> = { data: T[] };
type ApiSingle<T> = { data: T };

const server = new Server(
  { name: 'managecallai-mcp-server', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'list_extensions',
      description: 'List extensions for a tenant.',
      inputSchema: {
        type: 'object',
        required: ['tenant_id'],
        properties: {
          tenant_id: { type: 'string' },
        },
      },
    },
    {
      name: 'get_extension',
      description: 'Fetch a single extension by id.',
      inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
    },
    {
      name: 'list_call_events',
      description: 'List normalized call events for a tenant.',
      inputSchema: {
        type: 'object',
        properties: {
          tenant_id: { type: 'string' },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const args = (request.params.arguments ?? {}) as Record<string, string | undefined>;

  switch (request.params.name) {
    case 'list_extensions': {
      const tenantId = args['tenant_id'];
      if (!tenantId) {
        throw new Error('tenant_id is required');
      }

      const data = await fetchJson<ApiCollection<unknown>>(
        `/api/v1/extensions?tenant_id=${encodeURIComponent(tenantId)}`,
      );
      return { content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }] };
    }
    case 'get_extension': {
      const id = args['id'];
      if (!id) {
        throw new Error('id is required');
      }

      const data = await fetchJson<ApiSingle<unknown>>(
        `/api/v1/extensions/${encodeURIComponent(id)}`,
      );
      return { content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }] };
    }
    case 'list_call_events': {
      const tenantId = args['tenant_id'];
      const query = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
      const data = await fetchJson<ApiCollection<unknown>>(`/api/v1/call-events${query}`);
      return { content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }] };
    }
    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
