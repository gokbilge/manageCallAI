import { useQuery } from '@tanstack/react-query';
import { RefreshCcw, Zap, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { apiRequest } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';

type Webhook = {
  id: string;
  name: string;
  url: string;
  events: string[];
  failure_count: number;
  disabled_at: string | null;
  created_at: string;
  revoked_at: string | null;
};

type WebhookListResponse = { data: Webhook[] };

export function WebhooksPage() {
  const { session } = useAuth();

  const webhooksQuery = useQuery({
    queryKey: ['webhooks', session?.claims.tenant_id],
    enabled: Boolean(session?.token),
    queryFn: async () => {
      const result = await apiRequest<WebhookListResponse>('/webhooks', {
        accessToken: session!.token,
      });
      return result.data;
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenant Workspace"
        title="Webhooks"
        description="Outbound event delivery subscriptions. Events are delivered with an HMAC-SHA256 signature for verification. A subscription is automatically disabled after 5 consecutive failures."
        actions={
          <Button onClick={() => webhooksQuery.refetch()} variant="secondary">
            <RefreshCcw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <DataCard
        title="Active Subscriptions"
        description="Webhook endpoints receiving IVR lifecycle events for this tenant."
      >
        {webhooksQuery.isLoading ? (
          <p className="text-sm text-[var(--color-muted-fg)]">Loading webhooks...</p>
        ) : webhooksQuery.isError ? (
          <ErrorState
            title="Could not load webhooks"
            message={webhooksQuery.error instanceof Error ? webhooksQuery.error.message : 'Unknown error'}
          />
        ) : webhooksQuery.data && webhooksQuery.data.length > 0 ? (
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--color-surface-muted)] text-[var(--color-muted-fg)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">URL</th>
                  <th className="px-3 py-2 font-medium">Events</th>
                  <th className="px-3 py-2 font-medium">Failures</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
                {webhooksQuery.data.map((hook) => {
                  const isDisabled = hook.disabled_at !== null;
                  const isRevoked = hook.revoked_at !== null;
                  const status = isRevoked ? 'inactive' : isDisabled ? 'inactive' : 'active';
                  return (
                    <tr key={hook.id}>
                      <td className="px-3 py-2 font-medium">{hook.name}</td>
                      <td className="max-w-[20rem] truncate px-3 py-2 font-mono text-xs text-[var(--color-muted-fg)]">
                        {hook.url}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {hook.events.map((ev) => (
                            <span
                              key={ev}
                              className="inline-flex items-center gap-1 rounded-full bg-[var(--color-surface-muted)] px-2 py-0.5 text-xs font-mono text-[var(--color-muted-fg)]"
                            >
                              <Zap className="size-3" aria-hidden="true" />
                              {ev}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {hook.failure_count > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[var(--color-warning)]">
                            <AlertTriangle className="size-3" aria-hidden="true" />
                            {hook.failure_count}
                          </span>
                        ) : (
                          <span className="text-[var(--color-muted-fg)]">0</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No webhooks registered"
            description="Register a webhook via the API at POST /api/v1/webhooks to start receiving IVR lifecycle events."
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
