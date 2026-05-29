import { apiCall } from '../api-client.js';

export const APPROVAL_TOOLS = [
  {
    name: 'list_approvals',
    description:
      'List approval requests for this tenant. Pass status=pending to see what is waiting for a human decision.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', enum: ['pending', 'approved', 'rejected'], description: 'Filter by status' },
      },
    },
  },
  {
    name: 'get_approval',
    description: 'Get a single approval request with the associated flow and version details.',
    inputSchema: {
      type: 'object' as const,
      required: ['approval_id'],
      properties: {
        approval_id: { type: 'string', description: 'UUID of the approval request' },
      },
    },
  },
  {
    name: 'decide_approval',
    description:
      'Approve or reject a pending approval request. Requires the tenant.approvals.decide capability.',
    inputSchema: {
      type: 'object' as const,
      required: ['approval_id', 'decision'],
      properties: {
        approval_id: { type: 'string', description: 'UUID of the approval request' },
        decision: { type: 'string', enum: ['approve', 'reject'], description: 'The decision to record' },
        note: { type: 'string', description: 'Optional note to attach to the decision' },
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

export async function handleApprovalTool(name: string, args: Args): Promise<{ text: string; isError?: boolean }> {
  switch (name) {
    case 'list_approvals': {
      const qs = args.status ? `?status=${encodeURIComponent(String(args.status))}` : '';
      const r = await apiCall<{ data: unknown[] }>('GET', `/api/v1/approvals${qs}`);
      if (!r.ok) return { text: err(r.status, r.data), isError: true };
      return { text: ok(r.data) };
    }

    case 'get_approval': {
      const r = await apiCall<{ data: unknown }>('GET', `/api/v1/approvals/${args.approval_id}`);
      if (!r.ok) return { text: err(r.status, r.data), isError: true };
      return { text: ok(r.data) };
    }

    case 'decide_approval': {
      const endpoint = args.decision === 'approve'
        ? `/api/v1/approvals/${args.approval_id}/approve`
        : `/api/v1/approvals/${args.approval_id}/reject`;
      const body: Record<string, unknown> = {};
      if (args.note !== undefined) body.note = args.note;
      const r = await apiCall<{ data: unknown }>('POST', endpoint, body);
      if (!r.ok) return { text: err(r.status, r.data), isError: true };
      return { text: ok(r.data) };
    }

    default:
      return { text: `Unknown approval tool: ${name}`, isError: true };
  }
}
