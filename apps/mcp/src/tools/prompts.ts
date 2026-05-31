import { mcpToolInputSchemas } from '@managecallai/contracts';
import { apiCall } from '../api-client.js';

export const PROMPT_TOOLS = [
  {
    name: 'list_prompts',
    description: 'List all prompt assets for this tenant. Prompts are referenced by play_prompt and play_collect IVR nodes.',
    inputSchema: mcpToolInputSchemas.list_prompts,
  },
  {
    name: 'get_prompt',
    description: 'Get a single prompt asset by ID including its storage_uri status.',
    inputSchema: mcpToolInputSchemas.get_prompt,
  },
] as const;

type Args = Record<string, unknown>;

function ok(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function err(status: number, data: unknown): string {
  return `API error ${status}: ${JSON.stringify(data)}`;
}

export async function handlePromptTool(name: string, args: Args): Promise<{ text: string; isError?: boolean }> {
  switch (name) {
    case 'list_prompts': {
      const r = await apiCall<{ data: unknown[] }>('GET', '/api/v1/prompts');
      if (!r.ok) return { text: err(r.status, r.data), isError: true };
      return { text: ok(r.data) };
    }

    case 'get_prompt': {
      const r = await apiCall<{ data: unknown }>('GET', `/api/v1/prompts/${args.prompt_id}`);
      if (!r.ok) return { text: err(r.status, r.data), isError: true };
      return { text: ok(r.data) };
    }

    default:
      return { text: `Unknown prompt tool: ${name}`, isError: true };
  }
}
