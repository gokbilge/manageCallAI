import { useQuery } from '@tanstack/react-query';
import { PhoneCall, RefreshCcw } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';

type CallEvent = {
  id: string;
  tenant_id: string;
  call_id: string;
  event_type: string;
  event_time: string;
  source: string | null;
  payload: Record<string, unknown>;
  ingested_at: string;
};

type CallEventsResponse = {
  data: CallEvent[];
};

export function CallsPage() {
  const { session } = useAuth();

  const eventsQuery = useQuery({
    queryKey: ['call-events', session?.claims.tenant_id],
    enabled: Boolean(session?.token),
    queryFn: async () => {
      const result = await apiRequest<CallEventsResponse>('/call-events', {
        accessToken: session!.token,
      });
      return result.data;
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenant Workspace"
        title="Call Events"
        description="This view now reads the live runtime event summary surface from the tenant-scoped API."
        actions={
          <Button onClick={() => eventsQuery.refetch()} variant="secondary">
            <RefreshCcw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        }
      />
      <DataCard title="Recent Timeline" description="Business-level timeline first, raw payload details second.">
        {eventsQuery.isLoading ? (
          <p className="text-sm text-[var(--color-muted-fg)]">Loading call events...</p>
        ) : eventsQuery.isError ? (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-4 py-6 text-sm text-[var(--color-danger)]">
            Could not load call events: {eventsQuery.error instanceof Error ? eventsQuery.error.message : 'Unknown error'}
          </div>
        ) : eventsQuery.data && eventsQuery.data.length > 0 ? (
          <ol className="space-y-3">
            {eventsQuery.data.map((event) => (
              <li
                key={event.id}
                className="grid gap-3 rounded-[var(--radius-md)] bg-[var(--color-surface-muted)] px-4 py-4 lg:grid-cols-[auto_minmax(0,1fr)_20rem]"
              >
                <div className="rounded-full bg-[var(--color-info)]/10 p-2 text-[var(--color-info)]">
                  <PhoneCall className="size-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {event.event_type} on call <span className="font-mono text-xs">{event.call_id}</span>
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-muted-fg)]">
                    Source: {event.source ?? 'unknown'} • Ingested: {formatDate(event.ingested_at)}
                  </p>
                  <pre className="mt-3 overflow-x-auto rounded-[var(--radius-md)] bg-[#0f172a] p-3 text-xs text-slate-100">
                    <code>{JSON.stringify(event.payload, null, 2)}</code>
                  </pre>
                </div>
                <div className="text-xs text-[var(--color-muted-fg)] lg:text-right">
                  <p>Event time</p>
                  <p className="mt-1 font-mono text-[var(--color-fg)]">{formatDate(event.event_time)}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface-muted)] px-4 py-6 text-sm text-[var(--color-muted-fg)]">
            No call events yet. Start the runtime agent or ingest a test event to populate the tenant timeline.
          </div>
        )}
      </DataCard>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
