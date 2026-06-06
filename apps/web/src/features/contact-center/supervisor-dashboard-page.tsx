import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Clock3, RefreshCcw, ShieldAlert, Users } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { StatCard } from '@/components/data/stat-card';
import { Button } from '@/components/ui/button';
import { useQueueOptions } from '@/lib/ivr-flows/ivr-flows-api';
import {
  useCreateDispositionCode,
  useDispositionCodes,
  useQueueSlaPolicy,
  useSupervisorSnapshot,
  useUpdateDispositionCode,
  useUpdateQueueSlaPolicy,
  type DispositionCode,
  type QueueWallboardMetric,
} from '@/lib/contact-center/contact-center-api';

const inputClass =
  'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--color-tenant)]/40';

type SlaFormState = {
  answer_target_seconds: string;
  answer_rate_target_percent: string;
  abandonment_threshold_percent: string;
  wallboard_enabled: boolean;
};

type DispositionFormState = {
  queue_id: string;
  code: string;
  label: string;
  description: string;
  sort_order: string;
};

export function SupervisorDashboardPage() {
  const snapshotQuery = useSupervisorSnapshot();
  const queueOptionsQuery = useQueueOptions();
  const dispositionCodesQuery = useDispositionCodes();
  const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);

  const queueMetrics = useMemo(() => snapshotQuery.data?.queue_metrics ?? [], [snapshotQuery.data?.queue_metrics]);

  useEffect(() => {
    if (!selectedQueueId && queueMetrics.length > 0) {
      setSelectedQueueId(queueMetrics[0]!.queue_id);
    }
  }, [queueMetrics, selectedQueueId]);

  const selectedMetric = queueMetrics.find((metric) => metric.queue_id === selectedQueueId) ?? queueMetrics[0] ?? null;

  const totals = useMemo(() => {
    const alerts = queueMetrics.filter((metric) => metric.alert_state !== 'healthy').length;
    const offered = queueMetrics.reduce((sum, metric) => sum + metric.offered_calls_24h, 0);
    const active = queueMetrics.reduce((sum, metric) => sum + metric.active_calls, 0);
    const agents = snapshotQuery.data?.agent_availability.reduce((sum, bucket) => sum + bucket.count, 0) ?? 0;
    return {
      alerts,
      offered,
      active,
      agents,
    };
  }, [queueMetrics, snapshotQuery.data?.agent_availability]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Contact Center"
        title="Supervisor Dashboard"
        description="Monitor queue health, SLA drift, disposition usage, and QA backlog from one operating surface."
        actions={(
          <Button onClick={() => void snapshotQuery.refetch()} variant="secondary">
            <RefreshCcw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        )}
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Queues in Alert" value={String(totals.alerts)} icon={ShieldAlert} tone={totals.alerts > 0 ? 'tenant' : 'success'} />
        <StatCard title="Calls Offered (24h)" value={String(totals.offered)} icon={BarChart3} tone="tenant" />
        <StatCard title="Active Calls" value={String(totals.active)} icon={Clock3} tone="info" />
        <StatCard title="Agents Seen" value={String(totals.agents)} icon={Users} tone="success" />
      </div>

      {snapshotQuery.isLoading ? (
        <LoadingCard message="Loading supervisor snapshot..." />
      ) : snapshotQuery.isError ? (
        <ErrorCard message={snapshotQuery.error instanceof Error ? snapshotQuery.error.message : 'Could not load supervisor snapshot.'} />
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(22rem,1fr)]">
            <QueueMetricsCard
              metrics={queueMetrics}
              selectedQueueId={selectedMetric?.queue_id ?? null}
              onSelectQueue={setSelectedQueueId}
            />
            <QueueSlaPolicyCard
              selectedMetric={selectedMetric}
              queueName={queueOptionsQuery.data?.find((queue) => queue.id === selectedMetric?.queue_id)?.name ?? selectedMetric?.queue_name ?? null}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <DispositionUsageCard />
            <SupervisorSidebarCard />
          </div>

          <DispositionCatalogCard
            queueOptions={queueOptionsQuery.data ?? []}
            dispositionCodes={dispositionCodesQuery.data ?? []}
          />
        </>
      )}
    </div>
  );
}

function QueueMetricsCard({
  metrics,
  selectedQueueId,
  onSelectQueue,
}: {
  metrics: QueueWallboardMetric[];
  selectedQueueId: string | null;
  onSelectQueue: (queueId: string) => void;
}) {
  return (
    <DataCard
      title="Queue SLA Watch"
      description="Thresholds are operator-owned. This view shows where answer-rate and abandonment drift needs action."
    >
      {metrics.length === 0 ? (
        <EmptyCard message="No active queues are configured for this tenant." />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--color-surface-muted)] text-[var(--color-muted-fg)]">
              <tr>
                <th className="px-3 py-2 font-medium">Queue</th>
                <th className="px-3 py-2 font-medium">Agents</th>
                <th className="px-3 py-2 font-medium">SLA</th>
                <th className="px-3 py-2 font-medium">Wait</th>
                <th className="px-3 py-2 font-medium">Alert</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
              {metrics.map((metric) => (
                <tr
                  key={metric.queue_id}
                  className={`cursor-pointer ${selectedQueueId === metric.queue_id ? 'bg-[var(--color-surface-muted)]' : 'hover:bg-[var(--color-surface-muted)]'}`}
                  onClick={() => onSelectQueue(metric.queue_id)}
                >
                  <td className="px-3 py-2">
                    <p className="font-medium">{metric.queue_name}</p>
                    <p className="text-xs text-[var(--color-muted-fg)]">{metric.offered_calls_24h} offered in 24h</p>
                  </td>
                  <td className="px-3 py-2 text-xs text-[var(--color-muted-fg)]">
                    {metric.available_agents} ready / {metric.member_count} assigned
                  </td>
                  <td className="px-3 py-2 text-xs text-[var(--color-muted-fg)]">
                    {metric.sla_percent_24h == null ? 'n/a' : `${metric.sla_percent_24h}%`}
                    <div className="text-[10px]">target {metric.answer_rate_target_percent}% in {metric.answer_target_seconds}s</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-[var(--color-muted-fg)]">
                    avg {metric.average_wait_seconds == null ? 'n/a' : `${metric.average_wait_seconds}s`}
                    <div className="text-[10px]">max {metric.max_wait_seconds == null ? 'n/a' : `${metric.max_wait_seconds}s`}</div>
                  </td>
                  <td className="px-3 py-2">
                    <AlertPill state={metric.alert_state} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DataCard>
  );
}

function QueueSlaPolicyCard({
  selectedMetric,
  queueName,
}: {
  selectedMetric: QueueWallboardMetric | null;
  queueName: string | null;
}) {
  const queueId = selectedMetric?.queue_id ?? null;
  const policyQuery = useQueueSlaPolicy(queueId);
  const updatePolicy = useUpdateQueueSlaPolicy();
  const [form, setForm] = useState<SlaFormState>({
    answer_target_seconds: '',
    answer_rate_target_percent: '',
    abandonment_threshold_percent: '',
    wallboard_enabled: true,
  });

  useEffect(() => {
    if (!policyQuery.data) return;
    setForm({
      answer_target_seconds: String(policyQuery.data.answer_target_seconds),
      answer_rate_target_percent: String(policyQuery.data.answer_rate_target_percent),
      abandonment_threshold_percent: String(policyQuery.data.abandonment_threshold_percent),
      wallboard_enabled: policyQuery.data.wallboard_enabled,
    });
  }, [policyQuery.data]);

  function handleSubmit() {
    if (!queueId) return;
    void updatePolicy.mutateAsync({
      queueId,
      input: {
        answer_target_seconds: Number(form.answer_target_seconds),
        answer_rate_target_percent: Number(form.answer_rate_target_percent),
        abandonment_threshold_percent: Number(form.abandonment_threshold_percent),
        wallboard_enabled: form.wallboard_enabled,
      },
    });
  }

  return (
    <DataCard
      title={queueName ? `SLA Policy: ${queueName}` : 'Queue SLA Policy'}
      description="Supervisors can tune queue targets without leaving the live monitoring view."
    >
      {!selectedMetric ? (
        <EmptyCard message="Select a queue from the SLA watch table to inspect or update policy." />
      ) : policyQuery.isLoading ? (
        <p className="text-sm text-[var(--color-muted-fg)]">Loading queue policy...</p>
      ) : policyQuery.isError ? (
        <ErrorInline message={policyQuery.error instanceof Error ? policyQuery.error.message : 'Could not load queue policy.'} />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricTile label="Answered" value={String(selectedMetric.answered_calls_24h)} />
            <MetricTile label="Abandoned" value={String(selectedMetric.abandoned_calls_24h)} />
            <MetricTile label="Within SLA" value={String(selectedMetric.within_sla_calls_24h)} />
            <MetricTile label="Active Calls" value={String(selectedMetric.active_calls)} />
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-medium text-[var(--color-muted-fg)]">
              Answer target seconds
              <input
                className={inputClass}
                type="number"
                min={1}
                value={form.answer_target_seconds}
                onChange={(event) => setForm((current) => ({ ...current, answer_target_seconds: event.target.value }))}
              />
            </label>
            <label className="block text-xs font-medium text-[var(--color-muted-fg)]">
              Answer-rate target %
              <input
                className={inputClass}
                type="number"
                min={1}
                max={100}
                value={form.answer_rate_target_percent}
                onChange={(event) => setForm((current) => ({ ...current, answer_rate_target_percent: event.target.value }))}
              />
            </label>
            <label className="block text-xs font-medium text-[var(--color-muted-fg)]">
              Abandonment threshold %
              <input
                className={inputClass}
                type="number"
                min={0}
                max={100}
                value={form.abandonment_threshold_percent}
                onChange={(event) => setForm((current) => ({ ...current, abandonment_threshold_percent: event.target.value }))}
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--color-fg)]">
              <input
                type="checkbox"
                checked={form.wallboard_enabled}
                onChange={(event) => setForm((current) => ({ ...current, wallboard_enabled: event.target.checked }))}
              />
              Show this queue on the wallboard
            </label>
            <Button onClick={handleSubmit} disabled={updatePolicy.isPending}>
              {updatePolicy.isPending ? 'Saving...' : 'Save SLA Policy'}
            </Button>
          </div>
        </div>
      )}
    </DataCard>
  );
}

function DispositionUsageCard() {
  const snapshotQuery = useSupervisorSnapshot();
  const rows = snapshotQuery.data?.disposition_usage_24h ?? [];

  return (
    <DataCard
      title="Disposition Usage"
      description="Supervisors need the last 24-hour picture before changing codes or coaching note-taking behavior."
    >
      {rows.length === 0 ? (
        <EmptyCard message="No dispositions have been recorded in the last 24 hours." />
      ) : (
        <ul className="space-y-2">
          {rows.map((row, index) => (
            <li
              key={`${row.disposition_code_id ?? 'none'}-${index}`}
              className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-3"
            >
              <div className="min-w-0">
                <p className="font-medium">{row.disposition_label ?? row.disposition_code ?? 'Uncoded note'}</p>
                <p className="text-xs text-[var(--color-muted-fg)]">
                  {row.queue_name ?? 'All queues'} · last used {row.last_used_at ? formatDate(row.last_used_at) : 'unknown'}
                </p>
              </div>
              <span className="rounded-full bg-[var(--color-tenant)]/10 px-2.5 py-1 text-xs font-semibold text-[var(--color-tenant)]">
                {row.usage_count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </DataCard>
  );
}

function SupervisorSidebarCard() {
  const snapshotQuery = useSupervisorSnapshot();
  const qa = snapshotQuery.data?.qa_summary;

  return (
    <DataCard
      title="Agent and QA Posture"
      description="Contact-center coaching is only useful if queue pressure and QA backlog stay visible together."
    >
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-muted-fg)]">Agent availability</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(snapshotQuery.data?.agent_availability ?? []).map((bucket) => (
              <div key={bucket.state} className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-3">
                <p className="text-xs text-[var(--color-muted-fg)]">{bucket.state.replace('_', ' ')}</p>
                <p className="mt-1 text-lg font-semibold">{bucket.count}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricTile label="Open reviews" value={String(qa?.open_reviews ?? 0)} />
          <MetricTile label="Completed (7d)" value={String(qa?.completed_reviews_7d ?? 0)} />
          <MetricTile label="Avg QA %" value={qa?.average_score_percent_7d == null ? 'n/a' : `${qa.average_score_percent_7d}%`} />
        </div>
      </div>
    </DataCard>
  );
}

function DispositionCatalogCard({
  queueOptions,
  dispositionCodes,
}: {
  queueOptions: Array<{ id: string; name: string }>;
  dispositionCodes: DispositionCode[];
}) {
  const createDisposition = useCreateDispositionCode();
  const updateDisposition = useUpdateDispositionCode();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCode, setNewCode] = useState<DispositionFormState>({
    queue_id: '',
    code: '',
    label: '',
    description: '',
    sort_order: '0',
  });

  function resetNewCode() {
    setNewCode({
      queue_id: '',
      code: '',
      label: '',
      description: '',
      sort_order: '0',
    });
  }

  function handleCreate() {
    void createDisposition.mutateAsync({
      queue_id: newCode.queue_id || null,
      code: newCode.code.trim(),
      label: newCode.label.trim(),
      description: newCode.description.trim() || null,
      sort_order: Number(newCode.sort_order || '0'),
      status: 'active',
    }).then(() => resetNewCode());
  }

  return (
    <DataCard
      title="Disposition Catalog"
      description="Queue-specific and tenant-wide codes live together here so agents and supervisors see one consistent vocabulary."
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
        <div className="space-y-2">
          {dispositionCodes.length === 0 ? (
            <EmptyCard message="No disposition codes exist yet. Create the initial catalog for your queues." />
          ) : dispositionCodes.map((code) => (
            <DispositionCodeRow
              key={code.id}
              code={code}
              queueOptions={queueOptions}
              editing={editingId === code.id}
              onEdit={() => setEditingId((current) => current === code.id ? null : code.id)}
              onSave={(input) => void updateDisposition.mutateAsync({ id: code.id, input }).then(() => setEditingId(null))}
            />
          ))}
        </div>
        <div className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
          <p className="text-sm font-medium">Create disposition code</p>
          <label className="block text-xs font-medium text-[var(--color-muted-fg)]">
            Queue scope
            <select
              className={inputClass}
              value={newCode.queue_id}
              onChange={(event) => setNewCode((current) => ({ ...current, queue_id: event.target.value }))}
            >
              <option value="">All queues</option>
              {queueOptions.map((queue) => (
                <option key={queue.id} value={queue.id}>{queue.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-[var(--color-muted-fg)]">
            Code
            <input className={inputClass} value={newCode.code} onChange={(event) => setNewCode((current) => ({ ...current, code: event.target.value }))} />
          </label>
          <label className="block text-xs font-medium text-[var(--color-muted-fg)]">
            Label
            <input className={inputClass} value={newCode.label} onChange={(event) => setNewCode((current) => ({ ...current, label: event.target.value }))} />
          </label>
          <label className="block text-xs font-medium text-[var(--color-muted-fg)]">
            Description
            <textarea className={inputClass} rows={3} value={newCode.description} onChange={(event) => setNewCode((current) => ({ ...current, description: event.target.value }))} />
          </label>
          <label className="block text-xs font-medium text-[var(--color-muted-fg)]">
            Sort order
            <input className={inputClass} type="number" min={0} value={newCode.sort_order} onChange={(event) => setNewCode((current) => ({ ...current, sort_order: event.target.value }))} />
          </label>
          <Button
            onClick={handleCreate}
            disabled={createDisposition.isPending || !newCode.code.trim() || !newCode.label.trim()}
          >
            {createDisposition.isPending ? 'Creating...' : 'Add Code'}
          </Button>
        </div>
      </div>
    </DataCard>
  );
}

function DispositionCodeRow({
  code,
  queueOptions,
  editing,
  onEdit,
  onSave,
}: {
  code: DispositionCode;
  queueOptions: Array<{ id: string; name: string }>;
  editing: boolean;
  onEdit: () => void;
  onSave: (input: { queue_id?: string | null; label?: string; description?: string | null; status?: 'active' | 'inactive' }) => void;
}) {
  const [label, setLabel] = useState(code.label);
  const [description, setDescription] = useState(code.description ?? '');
  const [status, setStatus] = useState<'active' | 'inactive'>(code.status);

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{code.code} · {code.label}</p>
          <p className="text-xs text-[var(--color-muted-fg)]">
            {code.queue_id ? queueOptions.find((queue) => queue.id === code.queue_id)?.name ?? 'Scoped queue' : 'All queues'} · {code.status}
          </p>
        </div>
        <Button variant="secondary" onClick={onEdit}>{editing ? 'Cancel' : 'Edit'}</Button>
      </div>
      {editing && (
        <div className="mt-3 space-y-3">
          <label className="block text-xs font-medium text-[var(--color-muted-fg)]">
            Label
            <input className={inputClass} value={label} onChange={(event) => setLabel(event.target.value)} />
          </label>
          <label className="block text-xs font-medium text-[var(--color-muted-fg)]">
            Description
            <textarea className={inputClass} rows={2} value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <label className="block text-xs font-medium text-[var(--color-muted-fg)]">
            Status
            <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value as 'active' | 'inactive')}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </label>
          <Button onClick={() => onSave({ label: label.trim(), description: description.trim() || null, status })}>Save</Button>
        </div>
      )}
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-3">
      <p className="text-xs text-[var(--color-muted-fg)]">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function AlertPill({ state }: { state: QueueWallboardMetric['alert_state'] }) {
  const className = state === 'critical'
    ? 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]'
    : state === 'warning'
      ? 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]'
      : 'bg-[var(--color-success)]/10 text-[var(--color-success)]';

  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{state}</span>;
}

function LoadingCard({ message }: { message: string }) {
  return (
    <DataCard title="Loading" description="Waiting for contact-center data.">
      <p className="text-sm text-[var(--color-muted-fg)]">{message}</p>
    </DataCard>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface-muted)] px-4 py-6 text-sm text-[var(--color-muted-fg)]">
      {message}
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <DataCard title="Supervisor Dashboard" description="The contact-center snapshot could not be loaded.">
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-4 py-6 text-sm text-[var(--color-danger)]">
        <div className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="size-4" aria-hidden="true" />
          Snapshot error
        </div>
        <p className="mt-2">{message}</p>
      </div>
    </DataCard>
  );
}

function ErrorInline({ message }: { message: string }) {
  return <p className="text-sm text-[var(--color-danger)]">{message}</p>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
