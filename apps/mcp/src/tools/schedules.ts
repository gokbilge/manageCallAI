import { apiCall } from '../api-client.js';

export const SCHEDULE_TOOLS = [
  {
    name: 'list_schedules',
    description:
      'List all schedules for this tenant. Schedules define business hours and are referenced by business_hours IVR nodes.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
] as const;

type Args = Record<string, unknown>;

function ok(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function err(status: number, data: unknown): string {
  return `API error ${status}: ${JSON.stringify(data)}`;
}

export async function handleScheduleTool(name: string, args: Args): Promise<{ text: string; isError?: boolean }> {
  switch (name) {
    case 'list_schedules': {
      const r = await apiCall<{ data: unknown[] }>('GET', '/api/v1/schedules');
      if (!r.ok) return { text: err(r.status, r.data), isError: true };
      return { text: ok(r.data) };
    }

    default:
      return { text: `Unknown schedule tool: ${name}`, isError: true };
  }
}
