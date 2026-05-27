import { RefreshCcw, CheckCircle, XCircle, ShieldCheck } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/client';
import {
  useApprovals,
  useApproveRequest,
  useRejectRequest,
  usePolicies,
  type ApprovalRequest,
  type Policy,
} from '@/lib/approvals/approvals-api';

export function ApprovalsPage() {
  const queryClient = useQueryClient();
  const approvalsQuery = useApprovals();
  const policiesQuery = usePolicies();
  const approveRequest = useApproveRequest();
  const rejectRequest = useRejectRequest();

  const refreshMutation = useMutation({
    mutationFn: async () => {
      await queryClient.invalidateQueries({ queryKey: ['approvals'] });
      await queryClient.invalidateQueries({ queryKey: ['policies'] });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenant Workspace"
        title="Approval Queue"
        description="Review pending publish and rollback requests. Approved actions execute immediately."
        actions={(
          <Button onClick={() => void refreshMutation.mutateAsync()} variant="secondary">
            <RefreshCcw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        )}
      />

      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.75fr]">
        <DataCard
          title="Pending Requests"
          description="Requests waiting for an approve or reject decision."
        >
          {approvalsQuery.isLoading ? (
            <p className="text-sm text-[var(--color-muted-fg)]">Loading approvals...</p>
          ) : approvalsQuery.isError ? (
            <ErrorState
              title="Could not load approval requests"
              message={approvalsQuery.error instanceof Error ? approvalsQuery.error.message : 'Unknown error'}
            />
          ) : approvalsQuery.data && approvalsQuery.data.length > 0 ? (
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--color-surface-muted)] text-[var(--color-muted-fg)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Flow</th>
                    <th className="px-3 py-2 font-medium">Action</th>
                    <th className="px-3 py-2 font-medium">Requested By</th>
                    <th className="px-3 py-2 font-medium">Requested At</th>
                    <th className="px-3 py-2 font-medium">Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
                  {approvalsQuery.data.map((req) => (
                    <ApprovalRow
                      key={req.id}
                      request={req}
                      onApprove={() => void approveRequest.mutateAsync(req.id)}
                      onReject={() => void rejectRequest.mutateAsync(req.id)}
                      isPending={approveRequest.isPending || rejectRequest.isPending}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No pending approvals"
              description="All publish and rollback requests have been decided. New requests appear here when a policy requires approval."
            />
          )}
        </DataCard>

        <DataCard
          title="Active Policies"
          description="Tenant-level publish control policies currently in effect."
        >
          {policiesQuery.isLoading ? (
            <p className="text-sm text-[var(--color-muted-fg)]">Loading policies...</p>
          ) : policiesQuery.isError ? (
            <ErrorState
              title="Could not load policies"
              message={policiesQuery.error instanceof ApiError ? policiesQuery.error.message : 'Unknown error'}
            />
          ) : policiesQuery.data && policiesQuery.data.length > 0 ? (
            <ul className="space-y-2">
              {policiesQuery.data.map((policy) => (
                <PolicyRow key={policy.id} policy={policy} />
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No policies"
              description="No publish control policies are configured. Publishes execute immediately without approval."
            />
          )}
        </DataCard>
      </div>
    </div>
  );
}

function ApprovalRow({
  request,
  onApprove,
  onReject,
  isPending,
}: {
  request: ApprovalRequest;
  onApprove: () => void;
  onReject: () => void;
  isPending: boolean;
}) {
  return (
    <tr>
      <td className="px-3 py-2 font-medium">
        {request.flow_name ?? request.object_id}
      </td>
      <td className="px-3 py-2">
        <ActionBadge action={request.action_type} />
      </td>
      <td className="px-3 py-2 font-mono text-xs text-[var(--color-muted-fg)]">
        {request.requested_by ?? 'unknown'}
      </td>
      <td className="px-3 py-2 text-xs text-[var(--color-muted-fg)]">
        {new Date(request.created_at).toLocaleString()}
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-2">
          <Button
            disabled={isPending}
            onClick={onApprove}
            aria-label="Approve"
          >
            <CheckCircle className="size-3.5" aria-hidden="true" />
            Approve
          </Button>
          <Button
            variant="secondary"
            disabled={isPending}
            onClick={onReject}
            aria-label="Reject"
          >
            <XCircle className="size-3.5" aria-hidden="true" />
            Reject
          </Button>
        </div>
      </td>
    </tr>
  );
}

function ActionBadge({ action }: { action: 'publish' | 'rollback' | null }) {
  const label = action === 'rollback' ? 'Rollback' : 'Publish';
  const cls =
    action === 'rollback'
      ? 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]'
      : 'bg-[var(--color-tenant)]/10 text-[var(--color-tenant)]';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function PolicyRow({ policy }: { policy: Policy }) {
  return (
    <li className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-sm">
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--color-tenant)]" aria-hidden="true" />
      <div>
        <p className="font-medium">{policy.policy_type}</p>
        <p className="text-xs text-[var(--color-muted-fg)]">
          Status: {policy.status} &middot; Rules:{' '}
          {Object.entries(policy.rules)
            .map(([k, v]) => `${k}: ${String(v)}`)
            .join(', ') || 'none'}
        </p>
      </div>
    </li>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface-muted)] px-4 py-6 text-sm text-[var(--color-muted-fg)]">
      <p className="font-medium text-[var(--color-fg)]">{title}</p>
      <p className="mt-2">{description}</p>
    </div>
  );
}

function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-4 py-6 text-sm text-[var(--color-danger)]">
      <p className="font-medium">{title}</p>
      <p className="mt-2">{message}</p>
    </div>
  );
}
