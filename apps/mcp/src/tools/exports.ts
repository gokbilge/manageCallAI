import { apiCall } from '../api-client.js';

export const EXPORT_TOOLS = [
  {
    name: 'export_call_events',
    description:
      'Export up to 1000 call events for this tenant. Supports optional date range filtering. Use for debugging failed calls or generating call summaries.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        from: { type: 'string', description: 'ISO 8601 start datetime (inclusive)' },
        to: { type: 'string', description: 'ISO 8601 end datetime (inclusive)' },
        limit: { type: 'number', description: 'Maximum number of events to return (1–1000, default 100)' },
      },
    },
  },
  {
    name: 'export_sessions',
    description:
      'Export up to 1000 IVR session records for this tenant. Returns session metadata and step counts, not full replay data.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        from: { type: 'string', description: 'ISO 8601 start datetime (inclusive)' },
        to: { type: 'string', description: 'ISO 8601 end datetime (inclusive)' },
        limit: { type: 'number', description: 'Maximum sessions to return (1–1000, default 100)' },
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

function buildQs(args: Args, keys: string[]): string {
  const parts = keys
    .filter((k) => args[k] !== undefined)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(args[k]))}`);
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

export async function handleExportTool(name: string, args: Args): Promise<{ text: string; isError?: boolean }> {
  switch (name) {
    case 'export_call_events': {
      const qs = buildQs(args, ['from', 'to', 'limit']);
      const r = await apiCall<{ data: unknown[] }>('GET', `/api/v1/export/call-events${qs}`);
      if (!r.ok) return { text: err(r.status, r.data), isError: true };
      return { text: ok(r.data) };
    }

    case 'export_sessions': {
      const qs = buildQs(args, ['from', 'to', 'limit']);
      const r = await apiCall<{ data: unknown[] }>('GET', `/api/v1/export/sessions${qs}`);
      if (!r.ok) return { text: err(r.status, r.data), isError: true };
      return { text: ok(r.data) };
    }

    default:
      return { text: `Unknown export tool: ${name}`, isError: true };
  }
}
