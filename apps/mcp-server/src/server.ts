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
        required: ['tenant_id', 'access_token'],
        properties: {
          tenant_id: { type: 'string' },
          access_token: { type: 'string' },
        },
      },
    },
    {
      name: 'get_extension',
      description: 'Fetch a single extension by id.',
      inputSchema: {
        type: 'object',
        required: ['id', 'access_token'],
        properties: {
          id: { type: 'string' },
          access_token: { type: 'string' },
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
          access_token: { type: 'string' },
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
      const accessToken = args['access_token'];
      if (!tenantId || !accessToken) {
        throw new Error('tenant_id and access_token are required');
      }

      const data = await fetchJson<ApiCollection<unknown>>(
        `/api/v1/extensions?tenant_id=${encodeURIComponent(tenantId)}`,
        accessToken,
      );
      return { content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }] };
    }
    case 'get_extension': {
      const id = args['id'];
      const accessToken = args['access_token'];
      if (!id || !accessToken) {
        throw new Error('id and access_token are required');
      }

      const data = await fetchJson<ApiSingle<unknown>>(
        `/api/v1/extensions/${encodeURIComponent(id)}`,
        accessToken,
      );
      return { content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }] };
    }
    case 'list_call_events': {
      const tenantId = args['tenant_id'];
      const accessToken = args['access_token'];
      const query = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
      const data = await fetchJson<ApiCollection<unknown>>(`/api/v1/call-events${query}`, accessToken);
      return { content: [{ type: 'text', text: JSON.stringify(data.data, null, 2) }] };
    }
    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
