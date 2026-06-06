import { Activity, AlertTriangle, Clock3, PhoneCall, RefreshCcw, Users } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { Button } from '@/components/ui/button';
import { useQueueWallboard, type QueueWallboardMetric } from '@/lib/contact-center/contact-center-api';

export function QueueWallboardPage() {
  const wallboardQuery = useQueueWallboard(10000);
  const snapshot = wallboardQuery.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Contact Center"
        title="Queue Wallboard"
        description="Large-format operational view for answer-rate drift, wait pressure, and agent readiness."
        actions={(
          <Button onClick={() => void wallboardQuery.refetch()} variant="secondary">
            <RefreshCcw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        )}
      />

      {wallboardQuery.isLoading ? (
        <DataCard title="Wallboard" description="Loading queue metrics.">
          <p className="text-sm text-[var(--color-muted-fg)]">Loading wallboard snapshot...</p>
        </DataCard>
      ) : wallboardQuery.isError ? (
        <DataCard title="Wallboard" description="Wallboard data could not be loaded.">
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-4 py-6 text-sm text-[var(--color-danger)]">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="size-4" aria-hidden="true" />
              Wallboard error
            </div>
            <p className="mt-2">{wallboardQuery.error instanceof Error ? wallboardQuery.error.message : 'Unknown error'}</p>
          </div>
        </DataCard>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-4">
            <WallboardSummaryCard
              icon={Users}
              label="Available agents"
              value={String(snapshot?.agent_availability.find((bucket) => bucket.state === 'available')?.count ?? 0)}
            />
            <WallboardSummaryCard
              icon={PhoneCall}
              label="Calls offered"
              value={String(snapshot?.queue_metrics.reduce((sum, metric) => sum + metric.offered_calls_24h, 0) ?? 0)}
            />
            <WallboardSummaryCard
              icon={Clock3}
              label="Active calls"
              value={String(snapshot?.queue_metrics.reduce((sum, metric) => sum + metric.active_calls, 0) ?? 0)}
            />
            <WallboardSummaryCard
              icon={Activity}
              label="Queues in alert"
              value={String(snapshot?.queue_metrics.filter((metric) => metric.alert_state !== 'healthy').length ?? 0)}
            />
          </div>

          {!snapshot || snapshot.queue_metrics.length === 0 ? (
            <DataCard title="Wallboard" description="No queue is enabled for wallboard output.">
              <p className="text-sm text-[var(--color-muted-fg)]">
                Enable wallboard visibility in the supervisor SLA policy view for at least one queue.
              </p>
            </DataCard>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {snapshot.queue_metrics.map((metric) => (
                <QueueWallboardCard key={metric.queue_id} metric={metric} generatedAt={snapshot.generated_at} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function WallboardSummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[linear-gradient(135deg,var(--color-surface),var(--color-surface-muted))] p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted-fg)]">{label}</p>
        <Icon className="size-5 text-[var(--color-tenant)]" aria-hidden="true" />
      </div>
      <p className="mt-4 text-4xl font-semibold">{value}</p>
    </div>
  );
}

function QueueWallboardCard({ metric, generatedAt }: { metric: QueueWallboardMetric; generatedAt: string }) {
  const statusClass = metric.alert_state === 'critical'
    ? 'border-[var(--color-danger)]/35 bg-[linear-gradient(135deg,rgba(239,68,68,0.12),rgba(255,255,255,0.02))]'
    : metric.alert_state === 'warning'
      ? 'border-[var(--color-warning)]/35 bg-[linear-gradient(135deg,rgba(245,158,11,0.12),rgba(255,255,255,0.02))]'
      : 'border-[var(--color-success)]/25 bg-[linear-gradient(135deg,rgba(34,197,94,0.10),rgba(255,255,255,0.02))]';

  return (
    <section className={`rounded-[var(--radius-2xl)] border p-6 shadow-[var(--shadow-card)] ${statusClass}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-2xl font-semibold">{metric.queue_name}</p>
          <p className="mt-1 text-sm text-[var(--color-muted-fg)]">
            Updated {new Date(generatedAt).toLocaleTimeString()} · target {metric.answer_rate_target_percent}% within {metric.answer_target_seconds}s
          </p>
        </div>
        <span className="rounded-full bg-black/10 px-3 py-1 text-sm font-semibold capitalize">
          {metric.alert_state}
        </span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <WallboardMetricTile label="SLA %" value={metric.sla_percent_24h == null ? 'n/a' : `${metric.sla_percent_24h}%`} />
        <WallboardMetricTile label="Calls answered" value={String(metric.answered_calls_24h)} />
        <WallboardMetricTile label="Avg wait" value={metric.average_wait_seconds == null ? 'n/a' : `${metric.average_wait_seconds}s`} />
        <WallboardMetricTile label="Abandoned" value={String(metric.abandoned_calls_24h)} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-5">
        <AvailabilityChip label="Ready" value={metric.available_agents} />
        <AvailabilityChip label="Busy" value={metric.busy_agents} />
        <AvailabilityChip label="Away" value={metric.away_agents} />
        <AvailabilityChip label="Wrap-up" value={metric.wrap_up_agents} />
        <AvailabilityChip label="Offline" value={metric.offline_agents} />
      </div>
    </section>
  );
}

function WallboardMetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-black/10 bg-white/40 px-4 py-4 backdrop-blur-sm">
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-muted-fg)]">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function AvailabilityChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-black/10 bg-white/35 px-3 py-3 text-center backdrop-blur-sm">
      <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-muted-fg)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
