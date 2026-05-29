import { useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { useRuntimeSessionReplay, useRuntimeSessions } from '@/lib/runtime/runtime-api';

export function RuntimeSessionsPage() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const sessionsQuery = useRuntimeSessions();
  const replayQuery = useRuntimeSessionReplay(selectedSessionId ?? '');

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenant Workspace"
        title="Runtime Sessions"
        description="Read-only view of IVR call sessions. Each row represents one active or completed call that entered a published IVR flow."
        actions={
          <Button onClick={() => sessionsQuery.refetch()} variant="secondary">
            <RefreshCcw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <DataCard title="IVR Sessions" description="Most recent 200 sessions across all flows for this tenant.">
        {sessionsQuery.isLoading ? (
          <p className="text-sm text-[var(--color-muted-fg)]">Loading sessions...</p>
        ) : sessionsQuery.isError ? (
          <ErrorState
            title="Could not load sessions"
            message={sessionsQuery.error instanceof Error ? sessionsQuery.error.message : 'Unknown error'}
          />
        ) : sessionsQuery.data && sessionsQuery.data.length > 0 ? (
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--color-surface-muted)] text-[var(--color-muted-fg)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Call ID</th>
                  <th className="px-3 py-2 font-medium">Caller</th>
                  <th className="px-3 py-2 font-medium">Current node</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Started</th>
                  <th className="px-3 py-2 font-medium text-right">Replay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
                {sessionsQuery.data.map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2 font-mono text-xs">{s.call_id}</td>
                    <td className="px-3 py-2 font-mono text-xs text-[var(--color-muted-fg)]">
                      {s.caller_number ?? '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-[var(--color-muted-fg)]">
                      {s.current_node_id ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={s.status === 'running' ? 'active' : s.status === 'completed' ? 'active' : 'inactive'} />
                    </td>
                    <td className="px-3 py-2 text-xs text-[var(--color-muted-fg)]">
                      {new Date(s.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        className="text-xs font-medium text-[var(--color-tenant)] hover:underline"
                        onClick={() => setSelectedSessionId(s.id)}
                        type="button"
                      >
                        View replay
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No sessions yet"
            description="Sessions appear here when inbound calls enter a published IVR flow via the FreeSWITCH runtime."
          />
        )}
      </DataCard>

      <DataCard title="Session Replay" description="Select a row above to inspect the durable step history and related call events.">
        {!selectedSessionId ? (
          <p className="text-sm text-[var(--color-muted-fg)]">Choose a session to inspect its replay trace.</p>
        ) : replayQuery.isLoading ? (
          <p className="text-sm text-[var(--color-muted-fg)]">Loading replay...</p>
        ) : replayQuery.isError ? (
          <ErrorState
            title="Could not load replay"
            message={replayQuery.error instanceof Error ? replayQuery.error.message : 'Unknown error'}
          />
        ) : replayQuery.data ? (
          <div className="space-y-4">
            <div className="grid gap-3 text-sm md:grid-cols-3">
              <ReplayMeta label="Call ID" value={replayQuery.data.session.call_id} mono />
              <ReplayMeta label="Caller" value={replayQuery.data.session.caller_number ?? 'unknown'} mono />
              <ReplayMeta label="Status" value={replayQuery.data.session.status} />
            </div>
            <div className="space-y-3">
              {replayQuery.data.steps.map((step) => (
                <div key={step.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold">Step {step.step_index}</p>
                    <StatusBadge status={step.resulting_status === 'failed' ? 'warning' : step.resulting_status === 'running' ? 'active' : 'published'} />
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-muted-fg)]">
                    {step.phase} • outcome: {step.outcome}
                    {step.digits ? ` • digits: ${step.digits}` : ''}
                  </p>
                  {step.action_json ? (
                    <pre className="mt-3 overflow-x-auto rounded-[var(--radius-md)] bg-[#0f172a] p-3 text-xs text-slate-100">
                      <code>{JSON.stringify(step.action_json, null, 2)}</code>
                    </pre>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.1em] text-[var(--color-muted-fg)]">Related Call Events</p>
              {replayQuery.data.call_events.length > 0 ? (
                replayQuery.data.call_events.map((event) => (
                  <div key={event.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-medium">{event.event_type}</p>
                      <p className="text-xs text-[var(--color-muted-fg)]">{new Date(event.event_time).toLocaleString()}</p>
                    </div>
                    <pre className="mt-3 overflow-x-auto rounded-[var(--radius-md)] bg-[#0f172a] p-3 text-xs text-slate-100">
                      <code>{JSON.stringify(event.payload, null, 2)}</code>
                    </pre>
                  </div>
                ))
              ) : (
                <p className="text-sm text-[var(--color-muted-fg)]">No related call events recorded for this session yet.</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--color-muted-fg)]">No replay data found for that session.</p>
        )}
      </DataCard>
    </div>
  );
}

function ReplayMeta({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-[0.1em] text-[var(--color-muted-fg)]">{label}</p>
      <p className={mono ? 'font-mono text-xs text-[var(--color-fg)]' : 'text-sm text-[var(--color-fg)]'}>{value}</p>
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
