import { apiCall } from '../api-client.js';

export const RECORDING_TOOLS = [
  {
    name: 'list_recordings',
    description:
      'List call recording metadata for this tenant. Optionally filter by call_id. Does not expose raw storage paths.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        call_id: { type: 'string', description: 'Filter recordings by call ID' },
      },
    },
  },
  {
    name: 'get_recording',
    description: 'Get a single recording by ID including analysis request status.',
    inputSchema: {
      type: 'object' as const,
      required: ['recording_id'],
      properties: {
        recording_id: { type: 'string', description: 'UUID of the recording' },
      },
    },
  },
  {
    name: 'list_recording_analyses',
    description: 'List transcription and summary requests for a recording.',
    inputSchema: {
      type: 'object' as const,
      required: ['recording_id'],
      properties: {
        recording_id: { type: 'string', description: 'UUID of the recording' },
      },
    },
  },
  {
    name: 'get_recording_analysis',
    description:
      'Get a single analysis request including status, transcript text, and summary text when processing is complete.',
    inputSchema: {
      type: 'object' as const,
      required: ['recording_id', 'analysis_request_id'],
      properties: {
        recording_id: { type: 'string', description: 'UUID of the recording' },
        analysis_request_id: { type: 'string', description: 'UUID of the analysis request' },
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

export async function handleRecordingTool(name: string, args: Args): Promise<{ text: string; isError?: boolean }> {
  switch (name) {
    case 'list_recordings': {
      const qs = args.call_id ? `?call_id=${encodeURIComponent(String(args.call_id))}` : '';
      const r = await apiCall<{ data: unknown[] }>('GET', `/api/v1/recordings${qs}`);
      if (!r.ok) return { text: err(r.status, r.data), isError: true };
      return { text: ok(r.data) };
    }

    case 'get_recording': {
      const r = await apiCall<{ data: unknown }>('GET', `/api/v1/recordings/${args.recording_id}`);
      if (!r.ok) return { text: err(r.status, r.data), isError: true };
      return { text: ok(r.data) };
    }

    case 'list_recording_analyses': {
      const r = await apiCall<{ data: unknown[] }>('GET', `/api/v1/recordings/${args.recording_id}/analysis-requests`);
      if (!r.ok) return { text: err(r.status, r.data), isError: true };
      return { text: ok(r.data) };
    }

    case 'get_recording_analysis': {
      const r = await apiCall<{ data: unknown }>(
        'GET',
        `/api/v1/recordings/${args.recording_id}/analysis-requests/${args.analysis_request_id}`,
      );
      if (!r.ok) return { text: err(r.status, r.data), isError: true };
      return { text: ok(r.data) };
    }

    default:
      return { text: `Unknown recording tool: ${name}`, isError: true };
  }
}
