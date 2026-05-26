import { Building2, RadioTower, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/data/stat-card';
import { DataCard } from '@/components/data/data-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { usePlatformRuntimeHealth } from '@/lib/platform/platform-api';

export function PlatformHomePage() {
  const healthQuery = usePlatformRuntimeHealth();
  const services = healthQuery.data ?? [];
  const healthyCount = services.filter((s) => s.status === 'healthy').length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform Workspace"
        title="Platform Management"
        description="Global operator surface for runtime health and platform-level policies, using only backend contracts that exist today."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Current Tenant Context" value="1 active JWT tenant" icon={Building2} tone="platform" />
        <StatCard
          title="Checked Services"
          value={`${healthyCount}/${services.length || 2} healthy`}
          icon={RadioTower}
          tone="platform"
        />
        <StatCard title="Audit Coverage" value="100%" icon={ShieldCheck} tone="platform" />
      </div>
      <DataCard
        title="Live Platform Signals"
        description="Service health is fetched from the backend platform endpoint, which probes each service server-side."
      >
        {healthQuery.isLoading ? (
          <p className="text-sm text-[var(--color-muted-fg)]">Checking API and worker health…</p>
        ) : healthQuery.error ? (
          <p className="text-sm text-[var(--color-danger)]">
            Could not fetch platform health. Ensure your account has platform operator access.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {services.map((service) => (
              <div
                key={service.name}
                className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold capitalize">{service.name}</p>
                    <p className="mt-1 text-xs font-mono text-[var(--color-muted-fg)]">{service.url}</p>
                  </div>
                  <StatusBadge status={service.status === 'healthy' ? 'active' : 'warning'} />
                </div>
                <p className="mt-3 text-sm text-[var(--color-muted-fg)]">{service.detail}</p>
              </div>
            ))}
          </div>
        )}
      </DataCard>
    </div>
  );
}
