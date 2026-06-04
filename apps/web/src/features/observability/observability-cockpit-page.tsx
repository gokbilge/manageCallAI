import {
  Activity,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  PhoneCall,
  RefreshCcw,
  Server,
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
import { buildCallSummaries, useCallEvents, type CallSummary } from '@/lib/calls/call-events-api';
import { useLiveSnapshot, type RunningSession } from '@/lib/observability/observability-api';
import { useGatewayStatus } from '@/lib/sip-trunks/sip-trunks-api';

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

function FreshnessIndicator({ generatedAt, isStale }: { generatedAt: string; isStale: boolean }) {
  const age = formatAgo(generatedAt);
  return (
    <div className="flex items-center gap-2 text-xs text-[var(--color-muted-fg)]">
      {isStale ? (
        <WifiOff className="size-3.5 text-[var(--color-warning)]" aria-hidden="true" />
      ) : (
        <Wifi className="size-3.5 text-[var(--color-success)]" aria-hidden="true" />
      )}
      <span>{isStale ? 'Stale - ' : 'Live - '}updated {age}</span>
    </div>
  );
}

function SessionRow({ session }: { session: RunningSession }) {
  return (
    <tr className="border-b border-[var(--color-border)] last:border-0">
      <td className="py-2.5 pr-4 font-mono text-xs text-[var(--color-fg)]">
        {session.call_id.slice(0, 16)}...
      </td>
      <td className="py-2.5 pr-4 text-xs text-[var(--color-muted-fg)]">
        {session.caller_number ?? '-'}
      </td>
      <td className="py-2.5 pr-4 text-xs font-mono text-[var(--color-muted-fg)]">
        {session.current_node_id ?? '-'}
      </td>
      <td className="py-2.5 text-xs text-[var(--color-muted-fg)]">
        {formatAgo(session.started_at)}
      </td>
    </tr>
  );
}

export function ObservabilityCockpitPage() {
  const snapshotQuery = useLiveSnapshot();
  const gatewayStatusQuery = useGatewayStatus();
  const callEventsQuery = useCallEvents({ refetchInterval: 15_000 });
  const snapshot = snapshotQuery.data;
  const isStale = snapshotQuery.isStale && !snapshotQuery.isFetching;
  const error = snapshotQuery.error;
  const errorMessage = error instanceof Error ? error.message : 'Unexpected error';
  const isForbidden = error instanceof ApiError && error.status === 403;

  const webhookPressure = snapshot
    ? snapshot.webhook_backlog.pending + snapshot.webhook_backlog.failed + snapshot.webhook_backlog.abandoned
    : 0;
  const gatewayEntries = gatewayStatusQuery.data ?? [];
  const gatewayRegedCount = gatewayEntries.filter(entry => entry.state.toUpperCase() === 'REGED').length;
  const degradedGateways = gatewayEntries.filter(entry => entry.state.toUpperCase() !== 'REGED');
  const recentFailedCalls = buildCallSummaries(callEventsQuery.data ?? [])
    .filter(summary => summary.status === 'failed')
    .slice(0, 5);

  const triageItems = [
    snapshot && snapshot.recent_session_failures_1h > 0
      ? {
          label: 'Session failures in the last hour',
          value: String(snapshot.recent_session_failures_1h),
          detail: 'Review runtime sessions and failed branches.',
        }
      : null,
    degradedGateways.length > 0
      ? {
          label: 'Gateways not REGED',
          value: String(degradedGateways.length),
          detail: 'Carrier registration or profile state needs review.',
        }
      : null,
    snapshot && snapshot.webhook_backlog.failed + snapshot.webhook_backlog.abandoned > 0
      ? {
          label: 'Webhook deliveries requiring attention',
          value: String(snapshot.webhook_backlog.failed + snapshot.webhook_backlog.abandoned),
          detail: 'Failed or abandoned deliveries are accumulating.',
        }
      : null,
    recentFailedCalls.length > 0
      ? {
          label: 'Recent failed calls',
          value: String(recentFailedCalls.length),
          detail: 'Open the failed-call list below for reasons and numbers.',
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string; detail: string }>;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenant Workspace"
        title="Live Cockpit"
        description="Near-real-time operational view - refreshes every 5 seconds. No raw switch payloads or provider secrets are shown."
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

      {isStale && snapshot && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--color-warning)]/20 bg-[var(--color-warning)]/10 px-4 py-2.5 text-sm text-[var(--color-warning)]"
        >
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          <span>Snapshot is stale - last update may be delayed.</span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Active Sessions"
          value={snapshot ? String(snapshot.active_session_count) : '...'}
          icon={Activity}
          tone="tenant"
        />
        <StatCard
          title="Call Events (5 min)"
          value={snapshot ? String(snapshot.recent_call_events_5m) : '...'}
          icon={PhoneCall}
          tone="info"
        />
        <StatCard
          title="Pending Approvals"
          value={snapshot ? String(snapshot.pending_approvals) : '...'}
          icon={CheckCircle2}
          tone={snapshot && snapshot.pending_approvals > 0 ? 'tenant' : 'success'}
        />
        <StatCard
          title="Webhook Pressure"
          value={snapshot ? String(webhookPressure) : '...'}
          icon={Webhook}
          tone={snapshot && webhookPressure > 0 ? 'tenant' : 'success'}
        />
      </div>

      <DataCard
        title="Triage Queue"
        description="Highest-signal runtime, gateway, and call problems that need operator review first."
      >
        {snapshotQuery.isLoading ? (
          <p className="text-sm text-[var(--color-muted-fg)]">Loading triage signals...</p>
        ) : triageItems.length === 0 ? (
          <div className="flex items-center gap-2 py-4 text-sm text-[var(--color-muted-fg)]">
            <CheckCircle2 className="size-4 text-[var(--color-success)]" aria-hidden="true" />
            <span>No urgent runtime issues detected.</span>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {triageItems.map((item) => (
              <div
                key={item.label}
                className="rounded-[var(--radius-lg)] border border-[var(--color-warning)]/20 bg-[var(--color-warning)]/10 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xl font-semibold text-[var(--color-warning)]">{item.value}</p>
                </div>
                <p className="mt-2 text-xs text-[var(--color-muted-fg)]">{item.detail}</p>
              </div>
            ))}
          </div>
        )}
      </DataCard>

      <DataCard
        title="Running Sessions"
        description="IVR sessions currently executing. Links to session replay are available on the Sessions page."
      >
        {snapshotQuery.isLoading ? (
          <p className="text-sm text-[var(--color-muted-fg)]">Loading sessions...</p>
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
                {snapshot.running_sessions.map((session) => (
                  <SessionRow key={session.id} session={session} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>

      <DataCard
        title="Queue Configuration"
        description="Active queues and their configured member counts. Real-time call queue depth requires live FreeSWITCH state."
      >
        {snapshotQuery.isLoading ? (
          <p className="text-sm text-[var(--color-muted-fg)]">Loading queues...</p>
        ) : !snapshot || snapshot.queue_depths.length === 0 ? (
          <p className="py-4 text-sm text-[var(--color-muted-fg)]">No active queues configured</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {snapshot.queue_depths.map((queue) => (
              <div
                key={queue.queue_id}
                className="flex items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Users className="size-4 shrink-0 text-[var(--color-info)]" aria-hidden="true" />
                  <p className="truncate text-sm font-medium">{queue.queue_name}</p>
                </div>
                <p className="shrink-0 text-sm font-semibold">{queue.member_count}</p>
              </div>
            ))}
          </div>
        )}
      </DataCard>

      <DataCard
        title="Webhook Delivery Backlog"
        description="Outstanding webhook deliveries by status. Failed and abandoned items may need manual review."
      >
        {snapshotQuery.isLoading ? (
          <p className="text-sm text-[var(--color-muted-fg)]">Loading webhook state...</p>
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

      <DataCard
        title="FreeSWITCH Node Health"
        description="Runtime node registry status. Active nodes are accepting dialplan, directory, and event traffic."
      >
        {snapshotQuery.isLoading ? (
          <p className="text-sm text-[var(--color-muted-fg)]">Loading node status...</p>
        ) : !snapshot ? null : (
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-full ${snapshot.freeswitch_nodes.active > 0 ? 'bg-[var(--color-success)]/15' : 'bg-[var(--color-warning)]/15'}`}>
                <Server className={`size-4 ${snapshot.freeswitch_nodes.active > 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'}`} aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {snapshot.freeswitch_nodes.active}
                  <span className="ml-1 text-xs font-normal text-[var(--color-muted-fg)]">
                    / {snapshot.freeswitch_nodes.total} nodes active
                  </span>
                </p>
                <p className="text-xs text-[var(--color-muted-fg)]">
                  {snapshot.freeswitch_nodes.active === 0 && snapshot.freeswitch_nodes.total === 0
                    ? 'No nodes registered'
                    : snapshot.freeswitch_nodes.active === 0
                      ? 'All nodes offline or disabled'
                      : snapshot.freeswitch_nodes.active === snapshot.freeswitch_nodes.total
                        ? 'All nodes healthy'
                        : `${snapshot.freeswitch_nodes.total - snapshot.freeswitch_nodes.active} node(s) disabled`}
                </p>
              </div>
            </div>
          </div>
        )}
      </DataCard>

      <DataCard
        title="Gateway Registration"
        description="Latest tenant gateway states across the registered FreeSWITCH nodes."
      >
        {gatewayStatusQuery.isLoading ? (
          <p className="text-sm text-[var(--color-muted-fg)]">Loading gateway state...</p>
        ) : gatewayEntries.length === 0 ? (
          <p className="py-4 text-sm text-[var(--color-muted-fg)]">No tenant gateway status snapshots available yet.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3">
                <p className="text-xs text-[var(--color-muted-fg)]">Registered gateways</p>
                <p className="mt-1 text-2xl font-semibold">{gatewayRegedCount}</p>
              </div>
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3">
                <p className="text-xs text-[var(--color-muted-fg)]">Degraded gateways</p>
                <p className={`mt-1 text-2xl font-semibold ${degradedGateways.length > 0 ? 'text-[var(--color-warning)]' : ''}`}>{degradedGateways.length}</p>
              </div>
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3">
                <p className="text-xs text-[var(--color-muted-fg)]">Snapshots in view</p>
                <p className="mt-1 text-2xl font-semibold">{gatewayEntries.length}</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--color-surface-muted)] text-[var(--color-muted-fg)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Trunk</th>
                    <th className="px-3 py-2 font-medium">State</th>
                    <th className="px-3 py-2 font-medium">Node</th>
                    <th className="px-3 py-2 font-medium">Last poll</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
                  {gatewayEntries.slice(0, 8).map((entry) => (
                    <tr key={`${entry.trunk_id}-${entry.node_id}`}>
                      <td className="px-3 py-2">{entry.trunk_name}</td>
                      <td className={`px-3 py-2 text-xs font-semibold ${entry.state.toUpperCase() === 'REGED' ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'}`}>
                        {entry.state}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-[var(--color-muted-fg)]">{entry.node_id.slice(0, 12)}...</td>
                      <td className="px-3 py-2 text-xs text-[var(--color-muted-fg)]">{formatAgo(entry.queried_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DataCard>

      <DataCard
        title="Recent Failures"
        description="Session failures in the last hour and call activity in the last 5 minutes."
      >
        {snapshotQuery.isLoading ? (
          <p className="text-sm text-[var(--color-muted-fg)]">Loading...</p>
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

      <DataCard
        title="Recent Failed Calls"
        description="Most recent failed calls inferred from the normalized call-event stream."
      >
        {callEventsQuery.isLoading ? (
          <p className="text-sm text-[var(--color-muted-fg)]">Loading failed-call triage...</p>
        ) : recentFailedCalls.length === 0 ? (
          <div className="flex items-center gap-2 py-4 text-sm text-[var(--color-muted-fg)]">
            <CheckCircle2 className="size-4 text-[var(--color-success)]" aria-hidden="true" />
            <span>No recent failed calls in the current event window.</span>
          </div>
        ) : (
          <div className="space-y-3">
            {recentFailedCalls.map((summary) => (
              <FailedCallRow key={summary.call_id} summary={summary} />
            ))}
          </div>
        )}
      </DataCard>
    </div>
  );
}

function FailedCallRow({ summary }: { summary: CallSummary }) {
  const DirectionIcon = summary.direction === 'outbound' ? ArrowUpRight : ArrowDownLeft;

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <DirectionIcon className="size-4 shrink-0 text-[var(--color-danger)]" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {summary.counterpart ?? summary.call_id}
            </p>
            <p className="font-mono text-xs text-[var(--color-muted-fg)]">{summary.call_id.slice(0, 16)}...</p>
          </div>
        </div>
        <p className="text-xs text-[var(--color-muted-fg)]">{formatAgo(summary.last_event_at)}</p>
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-[var(--color-muted-fg)]">
        <span>Last event: {summary.last_event_type}</span>
        <span>Reason: {summary.failure_reason ?? 'unknown'}</span>
        <span>{summary.direction}</span>
      </div>
    </div>
  );
}
