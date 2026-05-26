import { Bot, RadioTower, RefreshCcw, Server, ServerOff } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/data/stat-card';
import { DataCard } from '@/components/data/data-card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { ApiError } from '@/lib/api/client';
import { usePlatformRuntimeHealth } from '@/lib/platform/platform-api';

export function RuntimeHealthPage() {
  const healthQuery = usePlatformRuntimeHealth();
  const services = healthQuery.data ?? [];
  const healthy = services.filter((s) => s.status === 'healthy').length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform Workspace"
        title="Runtime Health"
        description="Track stock FreeSWITCH nodes, adapter agents, and runtime integration health."
        actions={
          <Button onClick={() => healthQuery.refetch()} variant="secondary">
            <RefreshCcw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Reachable Services"
          value={`${healthy}/${services.length || 2}`}
          icon={RadioTower}
          tone="platform"
        />
        <StatCard
          title="Worker Surface"
          value={services.find((s) => s.name === 'worker')?.status ?? 'checking'}
          icon={Bot}
          tone="platform"
        />
        <StatCard
          title="API Surface"
          value={services.find((s) => s.name === 'api')?.status ?? 'checking'}
          icon={Server}
          tone="success"
        />
      </div>
      <DataCard
        title="Live Runtime Surfaces"
        description="These checks run server-side with a 3 s timeout per service. FreeSWITCH ESL and MCP stdio require dedicated backend endpoints before they can appear here."
      >
        {healthQuery.isLoading ? (
          <p className="text-sm text-[var(--color-muted-fg)]">Checking service health…</p>
        ) : healthQuery.error ? (
          <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-4 py-4 text-sm text-[var(--color-danger)]">
            <ServerOff className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium">
                {healthQuery.error instanceof ApiError && healthQuery.error.status === 403
                  ? 'Platform access required'
                  : 'Could not fetch runtime health'}
              </p>
              <p className="mt-1 opacity-80">
                {healthQuery.error instanceof Error ? healthQuery.error.message : 'Unexpected error'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {services.map((service) => (
              <div
                key={service.name}
                className="flex items-start justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold capitalize">{service.name}</p>
                  <p className="mt-1 text-xs font-mono text-[var(--color-muted-fg)]">{service.url}</p>
                  <p className="mt-2 text-sm text-[var(--color-muted-fg)]">{service.detail}</p>
                </div>
                <StatusBadge status={service.status === 'healthy' ? 'active' : 'warning'} />
              </div>
            ))}
          </div>
        )}
      </DataCard>
      <DataCard
        title="Current Runtime Boundary"
        description="The browser should not pretend it can see non-HTTP runtime channels directly."
      >
        <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--color-muted-fg)]">
          <li>
            API health is probed server-side at the configured{' '}
            <code className="font-mono text-xs">PLATFORM_API_HEALTH_URL</code> (default:{' '}
            <code className="font-mono text-xs">http://localhost:3000/health</code>).
          </li>
          <li>
            Worker health is probed server-side at the configured{' '}
            <code className="font-mono text-xs">PLATFORM_WORKER_HEALTH_URL</code> (default:{' '}
            <code className="font-mono text-xs">http://localhost:3400/health</code>).
          </li>
          <li>
            FreeSWITCH <code className="font-mono text-xs">mod_event_socket</code> and MCP stdio
            require dedicated backend endpoints before they can be rendered as first-class live
            status in the UI.
          </li>
        </ul>
      </DataCard>
    </div>
  );
}
