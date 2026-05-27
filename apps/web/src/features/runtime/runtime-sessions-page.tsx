import { useQuery } from '@tanstack/react-query';
import { RefreshCcw } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { apiRequest } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';

type RuntimeSession = {
  id: string;
  call_id: string;
  flow_id: string;
  status: 'running' | 'completed' | 'failed';
  current_node_id: string | null;
  caller_number: string | null;
  created_at: string;
  completed_at: string | null;
};

export function RuntimeSessionsPage() {
  const { session } = useAuth();

  const sessionsQuery = useQuery({
    queryKey: ['runtime-sessions', session?.claims.tenant_id],
    enabled: Boolean(session?.token),
    queryFn: async () => {
      const result = await apiRequest<{ data: RuntimeSession[] }>('/runtime/ivr/sessions', {
        accessToken: session!.token,
      });
      return result.data;
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenant Workspace"
        title="Runtime Sessions"
        description="Read-only view of IVR call sessions. Each row represents one active or completed call that entered a published IVR flow."
        actions={
          <Button onClick={() => sessionsQuery.refetch()} variant="secondary">
            <RefreshCcw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <DataCard title="IVR Sessions" description="Most recent 200 sessions across all flows for this tenant.">
        {sessionsQuery.isLoading ? (
          <p className="text-sm text-[var(--color-muted-fg)]">Loading sessions...</p>
        ) : sessionsQuery.isError ? (
          <ErrorState
            title="Could not load sessions"
            message={sessionsQuery.error instanceof Error ? sessionsQuery.error.message : 'Unknown error'}
          />
        ) : sessionsQuery.data && sessionsQuery.data.length > 0 ? (
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--color-surface-muted)] text-[var(--color-muted-fg)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Call ID</th>
                  <th className="px-3 py-2 font-medium">Caller</th>
                  <th className="px-3 py-2 font-medium">Current node</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Started</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
                {sessionsQuery.data.map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2 font-mono text-xs">{s.call_id}</td>
                    <td className="px-3 py-2 font-mono text-xs text-[var(--color-muted-fg)]">
                      {s.caller_number ?? '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-[var(--color-muted-fg)]">
                      {s.current_node_id ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={s.status === 'running' ? 'active' : s.status === 'completed' ? 'active' : 'inactive'} />
                    </td>
                    <td className="px-3 py-2 text-xs text-[var(--color-muted-fg)]">
                      {new Date(s.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No sessions yet"
            description="Sessions appear here when inbound calls enter a published IVR flow via the FreeSWITCH runtime."
          />
        )}
      </DataCard>
    </div>
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
