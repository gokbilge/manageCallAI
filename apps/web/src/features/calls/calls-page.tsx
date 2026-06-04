import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  PhoneCall,
  RefreshCcw,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { StatCard } from '@/components/data/stat-card';
import { Button } from '@/components/ui/button';
import { type CallSummary, useCallSummaries } from '@/lib/calls/call-events-api';

export function CallsPage() {
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState<'all' | 'inbound' | 'outbound' | 'unknown'>('all');
  const [status, setStatus] = useState<'all' | 'active' | 'completed' | 'failed'>('all');
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);

  const eventsQuery = useCallSummaries();

  const summaries = useMemo(() => {
    return eventsQuery.summaries.filter((summary) => {
      if (direction !== 'all' && summary.direction !== direction) return false;
      if (status !== 'all' && summary.status !== status) return false;
      if (search.trim().length === 0) return true;

      const haystack = [
        summary.call_id,
        summary.from_number,
        summary.to_number,
        summary.counterpart,
        summary.failure_reason,
        summary.last_event_type,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(search.trim().toLowerCase());
    });
  }, [direction, eventsQuery.summaries, search, status]);

  useEffect(() => {
    if (summaries.length === 0) {
      setSelectedCallId(null);
      return;
    }
    if (!selectedCallId || !summaries.some(summary => summary.call_id === selectedCallId)) {
      setSelectedCallId(summaries[0]!.call_id);
    }
  }, [selectedCallId, summaries]);

  const selectedCall = summaries.find(summary => summary.call_id === selectedCallId) ?? null;

  const totals = useMemo(() => {
    return {
      total: eventsQuery.summaries.length,
      active: eventsQuery.summaries.filter(summary => summary.status === 'active').length,
      completed: eventsQuery.summaries.filter(summary => summary.status === 'completed').length,
      failed: eventsQuery.summaries.filter(summary => summary.status === 'failed').length,
    };
  }, [eventsQuery.summaries]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenant Workspace"
        title="Call Reporting"
        description="CDR-style call history first, per-event payload detail second. Operators should not need raw backend inspection to triage basic call problems."
        actions={
          <Button onClick={() => eventsQuery.refetch()} variant="secondary">
            <RefreshCcw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Calls in View" value={String(totals.total)} icon={PhoneCall} tone="tenant" />
        <StatCard title="Active Calls" value={String(totals.active)} icon={Clock3} tone="info" />
        <StatCard title="Completed Calls" value={String(totals.completed)} icon={CheckCircle2} tone="success" />
        <StatCard title="Failed Calls" value={String(totals.failed)} icon={AlertTriangle} tone="tenant" />
      </div>

      <DataCard
        title="Call History"
        description="Filter recent calls by direction, status, or number. Select a row to inspect the event timeline."
      >
        <div className="grid gap-3 border-b border-[var(--color-border)] pb-4 md:grid-cols-[minmax(0,1fr)_12rem_12rem]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by call ID, number, or failure reason"
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-tenant)]"
          />
          <select
            aria-label="Direction filter"
            value={direction}
            onChange={(event) => setDirection(event.target.value as typeof direction)}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-tenant)]"
          >
            <option value="all">All directions</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
            <option value="unknown">Unknown</option>
          </select>
          <select
            aria-label="Outcome filter"
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-tenant)]"
          >
            <option value="all">All outcomes</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        {eventsQuery.isLoading ? (
          <p className="text-sm text-[var(--color-muted-fg)]">Loading call events...</p>
        ) : eventsQuery.isError ? (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-4 py-6 text-sm text-[var(--color-danger)]">
            Could not load call events: {eventsQuery.error instanceof Error ? eventsQuery.error.message : 'Unknown error'}
          </div>
        ) : summaries.length > 0 ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(20rem,1fr)]">
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--color-surface-muted)] text-[var(--color-muted-fg)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Call</th>
                    <th className="px-3 py-2 font-medium">Direction</th>
                    <th className="px-3 py-2 font-medium">Counterpart</th>
                    <th className="px-3 py-2 font-medium">Outcome</th>
                    <th className="px-3 py-2 font-medium">Last event</th>
                    <th className="px-3 py-2 font-medium">Last seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
                  {summaries.map((summary) => (
                    <CallSummaryRow
                      key={summary.call_id}
                      summary={summary}
                      selected={summary.call_id === selectedCallId}
                      onSelect={() => setSelectedCallId(summary.call_id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <DataCard
              title={selectedCall ? `Call ${selectedCall.call_id}` : 'Call Detail'}
              description={selectedCall ? 'Per-event timeline for the selected call.' : 'Select a call to inspect its event sequence.'}
            >
              {selectedCall ? <CallDetailPanel summary={selectedCall} /> : <p className="text-sm text-[var(--color-muted-fg)]">No call selected.</p>}
            </DataCard>
          </div>
        ) : (
          <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface-muted)] px-4 py-6 text-sm text-[var(--color-muted-fg)]">
            No calls matched the current filters. Adjust the filters or ingest runtime events to populate the tenant timeline.
          </div>
        )}
      </DataCard>
    </div>
  );
}

function CallSummaryRow({
  summary,
  selected,
  onSelect,
}: {
  summary: CallSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = summary.direction === 'outbound' ? ArrowUpRight : summary.direction === 'inbound' ? ArrowDownLeft : PhoneCall;
  const outcomeClass =
    summary.status === 'failed'
      ? 'text-[var(--color-danger)]'
      : summary.status === 'completed'
        ? 'text-[var(--color-success)]'
        : 'text-[var(--color-info)]';

  return (
    <tr
      className={`cursor-pointer ${selected ? 'bg-[var(--color-surface-muted)]' : 'hover:bg-[var(--color-surface-muted)]'}`}
      onClick={onSelect}
    >
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <Icon className="size-4 shrink-0 text-[var(--color-muted-fg)]" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-mono text-xs text-[var(--color-fg)]">{summary.call_id}</p>
            <p className="text-xs text-[var(--color-muted-fg)]">{summary.event_count} events</p>
          </div>
        </div>
      </td>
      <td className="px-3 py-2 text-xs text-[var(--color-muted-fg)]">{summary.direction}</td>
      <td className="px-3 py-2 text-xs text-[var(--color-muted-fg)]">{summary.counterpart ?? 'unknown'}</td>
      <td className={`px-3 py-2 text-xs font-semibold ${outcomeClass}`}>
        {summary.failure_reason ? `${summary.status}: ${summary.failure_reason}` : summary.status}
      </td>
      <td className="px-3 py-2 text-xs text-[var(--color-muted-fg)]">{summary.last_event_type}</td>
      <td className="px-3 py-2 text-xs text-[var(--color-muted-fg)]">{formatDate(summary.last_event_at)}</td>
    </tr>
  );
}

function CallDetailPanel({ summary }: { summary: CallSummary }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <KeyValue label="Direction" value={summary.direction} />
        <KeyValue label="Outcome" value={summary.failure_reason ? `${summary.status} (${summary.failure_reason})` : summary.status} />
        <KeyValue label="From" value={summary.from_number ?? 'unknown'} />
        <KeyValue label="To" value={summary.to_number ?? 'unknown'} />
        <KeyValue label="Started" value={formatDate(summary.started_at)} />
        <KeyValue label="Ended" value={summary.ended_at ? formatDate(summary.ended_at) : 'still active'} />
      </div>

      <div className="space-y-3">
        {summary.events.map((event) => (
          <div
            key={event.id}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium">{event.event_type}</p>
              <p className="text-xs text-[var(--color-muted-fg)]">{formatDate(event.event_time)}</p>
            </div>
            <p className="mt-1 text-xs text-[var(--color-muted-fg)]">
              Source: {event.source ?? 'unknown'} · Ingested {formatDate(event.ingested_at)}
            </p>
            <pre className="mt-3 overflow-x-auto rounded-[var(--radius-md)] bg-[#0f172a] p-3 text-xs text-slate-100">
              <code>{JSON.stringify(event.payload, null, 2)}</code>
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-3">
      <p className="text-xs text-[var(--color-muted-fg)]">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
