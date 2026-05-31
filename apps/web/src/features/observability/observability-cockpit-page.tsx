import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  PhoneCall,
  RefreshCcw,
  ServerOff,
  Users,
  Webhook,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/data/stat-card';
import { DataCard } from '@/components/data/data-card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { ApiError } from '@/lib/api/client';
import { useLiveSnapshot, type RunningSession } from '@/lib/observability/observability-api';

function formatAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FreshnessIndicator({ generatedAt, isStale }: { generatedAt: string; isStale: boolean }) {
  const age = formatAgo(generatedAt);
  return (
    <div className="flex items-center gap-2 text-xs text-[var(--color-muted-fg)]">
      {isStale ? (
        <WifiOff className="size-3.5 text-[var(--color-warning)]" aria-hidden="true" />
      ) : (
        <Wifi className="size-3.5 text-[var(--color-success)]" aria-hidden="true" />
      )}
      <span>{isStale ? 'Stale — ' : 'Live — '}updated {age}</span>
    </div>
  );
}

function SessionRow({ session }: { session: RunningSession }) {
  return (
    <tr className="border-b border-[var(--color-border)] last:border-0">
      <td className="py-2.5 pr-4 font-mono text-xs text-[var(--color-fg)]">
        {session.call_id.slice(0, 16)}…
      </td>
      <td className="py-2.5 pr-4 text-xs text-[var(--color-muted-fg)]">
        {session.caller_number ?? '—'}
      </td>
      <td className="py-2.5 pr-4 text-xs font-mono text-[var(--color-muted-fg)]">
        {session.current_node_id ?? '—'}
      </td>
      <td className="py-2.5 text-xs text-[var(--color-muted-fg)]">
        {formatAgo(session.started_at)}
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ObservabilityCockpitPage() {
  const snapshotQuery = useLiveSnapshot();
  const snapshot = snapshotQuery.data;
  const isStale = snapshotQuery.isStale && !snapshotQuery.isFetching;
  const error = snapshotQuery.error;
  const errorMessage = error instanceof Error ? error.message : 'Unexpected error';
  const isForbidden = error instanceof ApiError && error.status === 403;

  const webhookPressure = snapshot
    ? snapshot.webhook_backlog.pending + snapshot.webhook_backlog.failed + snapshot.webhook_backlog.abandoned
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenant Workspace"
        title="Live Cockpit"
        description="Near-real-time operational view — refreshes every 5 seconds. No raw switch payloads or provider secrets are shown."
        actions={
          <div className="flex items-center gap-3">
            {snapshot && (
              <FreshnessIndicator generatedAt={snapshot.generated_at} isStale={isStale} />
            )}
            <Button
              onClick={() => snapshotQuery.refetch()}
              variant="secondary"
              disabled={snapshotQuery.isFetching}
            >
              <RefreshCcw
                className={`size-4 ${snapshotQuery.isFetching ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              Refresh
            </Button>
          </div>
        }
      />

      {/* ── Error / disconnected state ── */}
      {error != null && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-4 py-4 text-sm text-[var(--color-danger)]"
        >
          <ServerOff className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">
              {isForbidden ? 'Operator access required' : 'Could not load live snapshot'}
            </p>
            <p className="mt-1 opacity-80">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* ── Stale warning ── */}
      {isStale && snapshot && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--color-warning)]/20 bg-[var(--color-warning)]/10 px-4 py-2.5 text-sm text-[var(--color-warning)]"
        >
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          <span>Snapshot is stale — last update may be delayed.</span>
        </div>
      )}

      {/* ── Stat row ── */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Active Sessions"
          value={snapshot ? String(snapshot.active_session_count) : '…'}
          icon={Activity}
          tone="tenant"
        />
        <StatCard
          title="Call Events (5 min)"
          value={snapshot ? String(snapshot.recent_call_events_5m) : '…'}
          icon={PhoneCall}
          tone="info"
        />
        <StatCard
          title="Pending Approvals"
          value={snapshot ? String(snapshot.pending_approvals) : '…'}
          icon={CheckCircle2}
          tone={snapshot && snapshot.pending_approvals > 0 ? 'tenant' : 'success'}
        />
        <StatCard
          title="Webhook Pressure"
          value={snapshot ? String(webhookPressure) : '…'}
          icon={Webhook}
          tone={snapshot && webhookPressure > 0 ? 'tenant' : 'success'}
        />
      </div>

      {/* ── Running sessions ── */}
      <DataCard
        title="Running Sessions"
        description="IVR sessions currently executing. Links to session replay are available on the Sessions page."
      >
        {snapshotQuery.isLoading ? (
          <p className="text-sm text-[var(--color-muted-fg)]">Loading sessions…</p>
        ) : !snapshot || snapshot.running_sessions.length === 0 ? (
          <div className="flex items-center gap-2 py-4 text-sm text-[var(--color-muted-fg)]">
            <CheckCircle2 className="size-4 text-[var(--color-success)]" aria-hidden="true" />
            <span>No active sessions</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="pb-2 pr-4 text-xs font-medium text-[var(--color-muted-fg)]">Call ID</th>
                  <th className="pb-2 pr-4 text-xs font-medium text-[var(--color-muted-fg)]">Caller</th>
                  <th className="pb-2 pr-4 text-xs font-medium text-[var(--color-muted-fg)]">Node</th>
                  <th className="pb-2 text-xs font-medium text-[var(--color-muted-fg)]">Started</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.running_sessions.map((s) => (
                  <SessionRow key={s.id} session={s} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>

      {/* ── Queue depths ── */}
      <DataCard
        title="Queue Configuration"
        description="Active queues and their configured member counts. Real-time call queue depth requires live FreeSWITCH state."
      >
        {snapshotQuery.isLoading ? (
          <p className="text-sm text-[var(--color-muted-fg)]">Loading queues…</p>
        ) : !snapshot || snapshot.queue_depths.length === 0 ? (
          <p className="py-4 text-sm text-[var(--color-muted-fg)]">No active queues configured</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {snapshot.queue_depths.map((q) => (
              <div
                key={q.queue_id}
                className="flex items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Users className="size-4 shrink-0 text-[var(--color-info)]" aria-hidden="true" />
                  <p className="truncate text-sm font-medium">{q.queue_name}</p>
                </div>
                <p className="shrink-0 text-sm font-semibold">{q.member_count}</p>
              </div>
            ))}
          </div>
        )}
      </DataCard>

      {/* ── Webhook backlog ── */}
      <DataCard
        title="Webhook Delivery Backlog"
        description="Outstanding webhook deliveries by status. Failed and abandoned items may need manual review."
      >
        {snapshotQuery.isLoading ? (
          <p className="text-sm text-[var(--color-muted-fg)]">Loading webhook state…</p>
        ) : !snapshot ? null : (
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { label: 'Pending', value: snapshot.webhook_backlog.pending, tone: 'info' as const },
              { label: 'Processing', value: snapshot.webhook_backlog.processing, tone: 'info' as const },
              { label: 'Failed', value: snapshot.webhook_backlog.failed, tone: (snapshot.webhook_backlog.failed > 0 ? 'warning' : 'active') as 'warning' | 'active' },
              { label: 'Abandoned', value: snapshot.webhook_backlog.abandoned, tone: (snapshot.webhook_backlog.abandoned > 0 ? 'warning' : 'active') as 'warning' | 'active' },
            ].map(({ label, value, tone }) => (
              <div
                key={label}
                className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3"
              >
                <p className="text-xs text-[var(--color-muted-fg)]">{label}</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-xl font-semibold">{value}</p>
                  <StatusBadge status={tone === 'warning' ? 'warning' : 'active'} />
                </div>
              </div>
            ))}
          </div>
        )}
      </DataCard>

      {/* ── Session health ── */}
      <DataCard
        title="Recent Failures"
        description="Session failures in the last hour and call activity in the last 5 minutes."
      >
        {snapshotQuery.isLoading ? (
          <p className="text-sm text-[var(--color-muted-fg)]">Loading…</p>
        ) : !snapshot ? null : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-[var(--color-muted-fg)]" aria-hidden="true" />
                <p className="text-sm text-[var(--color-muted-fg)]">Session failures (1 h)</p>
              </div>
              <p className={`text-xl font-semibold ${snapshot.recent_session_failures_1h > 0 ? 'text-[var(--color-danger)]' : ''}`}>
                {snapshot.recent_session_failures_1h}
              </p>
            </div>
            <div className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3">
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-[var(--color-muted-fg)]" aria-hidden="true" />
                <p className="text-sm text-[var(--color-muted-fg)]">Call events (5 min)</p>
              </div>
              <p className="text-xl font-semibold">{snapshot.recent_call_events_5m}</p>
            </div>
          </div>
        )}
      </DataCard>
    </div>
  );
}
