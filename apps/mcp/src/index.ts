import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { IVR_FLOW_TOOLS, handleTool } from './tools/ivr-flows.js';
import { APPROVAL_TOOLS, handleApprovalTool } from './tools/approvals.js';
import { PROMPT_TOOLS, handlePromptTool } from './tools/prompts.js';
import { RUNTIME_TOOLS, handleRuntimeTool } from './tools/runtime.js';
import { SCHEDULE_TOOLS, handleScheduleTool } from './tools/schedules.js';
import { RECORDING_TOOLS, handleRecordingTool } from './tools/recordings.js';
import { EXPORT_TOOLS, handleExportTool } from './tools/exports.js';
import { apiKey } from './api-client.js';

if (!apiKey) {
  process.stderr.write('[managecall-mcp] MANAGECALL_API_KEY is required\n');
  process.exit(1);
}

const ALL_TOOLS = [
  ...IVR_FLOW_TOOLS,
  ...APPROVAL_TOOLS,
  ...PROMPT_TOOLS,
  ...RUNTIME_TOOLS,
  ...SCHEDULE_TOOLS,
  ...RECORDING_TOOLS,
  ...EXPORT_TOOLS,
];

const APPROVAL_TOOL_NAMES = new Set<string>(APPROVAL_TOOLS.map((t) => t.name));
const PROMPT_TOOL_NAMES = new Set<string>(PROMPT_TOOLS.map((t) => t.name));
const RUNTIME_TOOL_NAMES = new Set<string>(RUNTIME_TOOLS.map((t) => t.name));
const SCHEDULE_TOOL_NAMES = new Set<string>(SCHEDULE_TOOLS.map((t) => t.name));
const RECORDING_TOOL_NAMES = new Set<string>(RECORDING_TOOLS.map((t) => t.name));
const EXPORT_TOOL_NAMES = new Set<string>(EXPORT_TOOLS.map((t) => t.name));

const server = new Server(
  { name: 'managecall-mcp', version: '0.3.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: ALL_TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = (args ?? {}) as Record<string, unknown>;

  let result: { text: string; isError?: boolean };
  if (APPROVAL_TOOL_NAMES.has(name)) {
    result = await handleApprovalTool(name, a);
  } else if (PROMPT_TOOL_NAMES.has(name)) {
    result = await handlePromptTool(name, a);
  } else if (RUNTIME_TOOL_NAMES.has(name)) {
    result = await handleRuntimeTool(name, a);
  } else if (SCHEDULE_TOOL_NAMES.has(name)) {
    result = await handleScheduleTool(name, a);
  } else if (RECORDING_TOOL_NAMES.has(name)) {
    result = await handleRecordingTool(name, a);
  } else if (EXPORT_TOOL_NAMES.has(name)) {
    result = await handleExportTool(name, a);
  } else {
    result = await handleTool(name, a);
  }

  return { content: [{ type: 'text', text: result.text }], isError: result.isError };
});

const transport = new StdioServerTransport();
await server.connect(transport);
