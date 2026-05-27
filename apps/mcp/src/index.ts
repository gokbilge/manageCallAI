import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { IVR_FLOW_TOOLS, handleTool } from './tools/ivr-flows.js';
import { apiKey } from './api-client.js';

if (!apiKey) {
  process.stderr.write('[managecall-mcp] MANAGECALL_API_KEY is required\n');
  process.exit(1);
}

const server = new Server(
  { name: 'managecall-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: IVR_FLOW_TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const result = await handleTool(name, (args ?? {}) as Record<string, unknown>);
  return { content: [{ type: 'text', text: result.text }], isError: result.isError };
});

const transport = new StdioServerTransport();
await server.connect(transport);
