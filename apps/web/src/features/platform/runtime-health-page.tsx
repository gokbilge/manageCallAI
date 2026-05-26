import { Bot, RadioTower, RefreshCcw, Server } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/data/stat-card';
import { DataCard } from '@/components/data/data-card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { useRuntimeHealth } from '@/lib/runtime/service-health';

export function RuntimeHealthPage() {
  const healthQuery = useRuntimeHealth();
  const services = healthQuery.data ?? [];
  const healthy = services.filter((service) => service.status === 'healthy').length;

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
        <StatCard title="Reachable Services" value={`${healthy}/${services.length || 2}`} icon={RadioTower} tone="platform" />
        <StatCard title="Worker Surface" value={services.find((service) => service.name === 'Worker')?.status ?? 'checking'} icon={Bot} tone="platform" />
        <StatCard title="API Surface" value={services.find((service) => service.name === 'API')?.status ?? 'checking'} icon={Server} tone="success" />
      </div>
      <DataCard
        title="Live Runtime Surfaces"
        description="These checks use currently reachable HTTP surfaces only. FreeSWITCH ESL and MCP stdio are intentionally not guessed from the browser."
      >
        {healthQuery.isLoading ? (
          <p className="text-sm text-[var(--color-muted-fg)]">Checking service health...</p>
        ) : (
          <div className="space-y-3">
            {services.map((service) => (
              <div
                key={service.name}
                className="flex items-start justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{service.name}</p>
                  <p className="mt-1 text-xs font-mono text-[var(--color-muted-fg)]">{service.baseUrl}</p>
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
          <li>API health is read from `/health`.</li>
          <li>Worker health is read from `/health` on the webhook service.</li>
          <li>FreeSWITCH `mod_event_socket` and MCP stdio require dedicated backend/platform endpoints before they can be rendered as first-class live status in the UI.</li>
        </ul>
      </DataCard>
    </div>
  );
}
