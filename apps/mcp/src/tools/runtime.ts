import { apiCall } from '../api-client.js';

export const RUNTIME_TOOLS = [
  {
    name: 'list_sessions',
    description:
      'List IVR runtime sessions for this tenant. Filter by status to see running, completed, or failed sessions.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['running', 'completed', 'failed'],
          description: 'Optional status filter',
        },
      },
    },
  },
  {
    name: 'get_session',
    description:
      'Get the full replay for a runtime session: session state, step-by-step node traversal, and associated call events.',
    inputSchema: {
      type: 'object' as const,
      required: ['session_id'],
      properties: {
        session_id: { type: 'string', description: 'UUID of the runtime session' },
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

export async function handleRuntimeTool(name: string, args: Args): Promise<{ text: string; isError?: boolean }> {
  switch (name) {
    case 'list_sessions': {
      const qs = args.status ? `?status=${encodeURIComponent(String(args.status))}` : '';
      const r = await apiCall<{ data: unknown[] }>('GET', `/api/v1/runtime/ivr/sessions${qs}`);
      if (!r.ok) return { text: err(r.status, r.data), isError: true };
      return { text: ok(r.data) };
    }

    case 'get_session': {
      const r = await apiCall<{ data: unknown }>('GET', `/api/v1/runtime/ivr/sessions/${args.session_id}`);
      if (!r.ok) return { text: err(r.status, r.data), isError: true };
      return { text: ok(r.data) };
    }

    default:
      return { text: `Unknown runtime tool: ${name}`, isError: true };
  }
}
