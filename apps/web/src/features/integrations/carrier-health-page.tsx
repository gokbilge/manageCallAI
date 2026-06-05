import { CheckCircle, RefreshCcw, Server, XCircle, AlertTriangle, HelpCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { Button } from '@/components/ui/button';
import { useGatewayStatus, useSipTrunks } from '@/lib/sip-trunks/sip-trunks-api';

type HealthLevel = 'healthy' | 'degraded' | 'down' | 'unknown';

function resolveHealth(state: string | null | undefined): HealthLevel {
  if (!state) return 'unknown';
  const s = state.toUpperCase();
  if (s === 'REGED') return 'healthy';
  if (s === 'DOWN' || s === 'FAILED') return 'down';
  if (s === 'TRYING' || s === 'REGISTER') return 'degraded';
  return 'unknown';
}

function healthIcon(level: HealthLevel) {
  if (level === 'healthy') return <CheckCircle className="size-5 text-[var(--color-success)]" aria-hidden="true" />;
  if (level === 'down') return <XCircle className="size-5 text-[var(--color-error)]" aria-hidden="true" />;
  if (level === 'degraded') return <AlertTriangle className="size-5 text-[var(--color-warning)]" aria-hidden="true" />;
  return <HelpCircle className="size-5 text-[var(--color-muted-fg)]" aria-hidden="true" />;
}

function healthLabel(level: HealthLevel): string {
  return { healthy: 'Registered', degraded: 'Registering', down: 'Down', unknown: 'No data' }[level];
}

function healthColor(level: HealthLevel): string {
  if (level === 'healthy') return 'text-[var(--color-success)]';
  if (level === 'down') return 'text-[var(--color-error)]';
  if (level === 'degraded') return 'text-[var(--color-warning)]';
  return 'text-[var(--color-muted-fg)]';
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export function CarrierHealthPage() {
  const trunksQ = useSipTrunks();
  const gatewayQ = useGatewayStatus();

  const activeTrunks = (trunksQ.data ?? []).filter(t => t.status === 'active');
  const gwEntries = gatewayQ.data ?? [];

  const trunkHealths = activeTrunks.map(trunk => {
    const entries = gwEntries.filter(e => e.trunk_id === trunk.id);
    const worst = entries.reduce<HealthLevel>((acc, e) => {
      const h = resolveHealth(e.state);
      if (h === 'down') return 'down';
      if (h === 'degraded' && acc !== 'down') return 'degraded';
      if (h === 'unknown' && acc === 'healthy') return 'unknown';
      return acc;
    }, entries.length === 0 ? 'unknown' : 'healthy');
    return { trunk, entries, health: worst };
  });

  const overall: HealthLevel = trunkHealths.length === 0
    ? 'unknown'
    : trunkHealths.every(t => t.health === 'healthy') ? 'healthy'
    : trunkHealths.some(t => t.health === 'down') ? 'down'
    : 'degraded';

  const healthCounts = {
    healthy: trunkHealths.filter(t => t.health === 'healthy').length,
    degraded: trunkHealths.filter(t => t.health === 'degraded').length,
    down: trunkHealths.filter(t => t.health === 'down').length,
    unknown: trunkHealths.filter(t => t.health === 'unknown').length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Integrations"
        title="Carrier Health"
        description="Aggregate registration state across all active SIP trunks. Auto-refreshes every 30 s. Use the Trunk Test Workflow for detailed per-trunk connectivity tests."
        actions={
          <Button variant="secondary" onClick={() => { void trunksQ.refetch(); void gatewayQ.refetch(); }}>
            <RefreshCcw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      {/* Overall status */}
      <DataCard title="Overall carrier health" description="Aggregate across all active trunks.">
        {trunksQ.isLoading || gatewayQ.isLoading ? (
          <p className="text-sm text-[var(--color-muted-fg)]">Loading…</p>
        ) : (
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              {healthIcon(overall)}
              <div>
                <p className={`text-lg font-semibold ${healthColor(overall)}`}>{healthLabel(overall)}</p>
                <p className="text-xs text-[var(--color-muted-fg)]">Overall status</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-[var(--color-success)]">
                <CheckCircle className="size-4" aria-hidden="true" />
                {healthCounts.healthy} registered
              </span>
              {healthCounts.degraded > 0 && (
                <span className="flex items-center gap-1.5 text-[var(--color-warning)]">
                  <AlertTriangle className="size-4" aria-hidden="true" />
                  {healthCounts.degraded} registering
                </span>
              )}
              {healthCounts.down > 0 && (
                <span className="flex items-center gap-1.5 text-[var(--color-error)]">
                  <XCircle className="size-4" aria-hidden="true" />
                  {healthCounts.down} down
                </span>
              )}
              {healthCounts.unknown > 0 && (
                <span className="flex items-center gap-1.5 text-[var(--color-muted-fg)]">
                  <HelpCircle className="size-4" aria-hidden="true" />
                  {healthCounts.unknown} no data
                </span>
              )}
            </div>
          </div>
        )}
      </DataCard>

      {/* Per-trunk cards */}
      <DataCard
        title="Trunk-by-trunk status"
        description="Registration state for each active trunk, across all FreeSWITCH nodes."
      >
        {trunksQ.isLoading ? (
          <p className="text-sm text-[var(--color-muted-fg)]">Loading trunks…</p>
        ) : trunksQ.isError ? (
          <p className="text-sm text-[var(--color-error)]">Could not load trunks.</p>
        ) : activeTrunks.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Server className="size-8 text-[var(--color-muted-fg)]" aria-hidden="true" />
            <p className="text-sm text-[var(--color-muted-fg)]">No active trunks. Add and activate a SIP trunk to see health data.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {trunkHealths.map(({ trunk, entries, health }) => (
              <div
                key={trunk.id}
                className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{trunk.name}</p>
                    <p className="text-xs font-mono text-[var(--color-muted-fg)] truncate">{trunk.realm}</p>
                  </div>
                  {healthIcon(health)}
                </div>
                <p className={`text-sm font-semibold ${healthColor(health)}`}>{healthLabel(health)}</p>
                {entries.length > 0 ? (
                  <div className="mt-2 space-y-1">
                    {entries.map(e => (
                      <div key={`${e.trunk_id}-${e.node_id}`} className="flex items-center justify-between text-xs text-[var(--color-muted-fg)]">
                        <span className="font-mono">node {e.node_id.slice(0, 8)}…</span>
                        <span>{relativeTime(e.queried_at)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-[var(--color-muted-fg)]">No runtime data available.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </DataCard>
    </div>
  );
}
