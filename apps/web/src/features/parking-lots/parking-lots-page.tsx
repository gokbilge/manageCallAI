import { useState } from 'react';
import { ChevronDown, ChevronRight, PauseCircle, Plus, RefreshCcw, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  type CreateParkingLotBody,
  type ParkedCall,
  type ParkingLot,
  useCreateParkingLot,
  useDeleteParkingLot,
  useParkedCalls,
  useParkingLots,
} from '@/lib/parking-lots/parking-lots-api';

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function parkedCallStatusColor(status: string): string {
  if (status === 'parked') return 'text-[var(--color-warning)]';
  if (status === 'retrieved') return 'text-[var(--color-success)]';
  if (status === 'timed_out') return 'text-[var(--color-error)]';
  return 'text-[var(--color-muted-fg)]';
}

// ── Parked-call sub-panel ─────────────────────────────────────────────────────

function ParkedCallsPanel({ lotId }: { lotId: string }) {
  const q = useParkedCalls(lotId);

  if (q.isLoading) {
    return <p className="text-xs text-[var(--color-muted-fg)]">Loading parked calls…</p>;
  }
  if (q.isError) {
    return <p className="text-xs text-[var(--color-error)]">Could not load parked calls.</p>;
  }

  const active = (q.data ?? []).filter(c => c.status === 'parked');

  if (active.length === 0) {
    return <p className="text-xs text-[var(--color-muted-fg)]">No calls currently parked in this lot.</p>;
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)]">
      <table className="w-full text-left text-xs">
        <thead className="bg-[var(--color-surface-muted)] text-[var(--color-muted-fg)]">
          <tr>
            <th className="px-3 py-1.5 font-medium">Slot</th>
            <th className="px-3 py-1.5 font-medium">Call ID</th>
            <th className="px-3 py-1.5 font-medium">Parked by</th>
            <th className="px-3 py-1.5 font-medium">Status</th>
            <th className="px-3 py-1.5 font-medium">Parked</th>
            <th className="px-3 py-1.5 font-medium">Times out</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
          {active.map((call: ParkedCall) => (
            <tr key={call.id}>
              <td className="px-3 py-1.5 font-mono font-bold">{call.slot}</td>
              <td className="px-3 py-1.5 font-mono text-[var(--color-muted-fg)]">{call.call_id.slice(0, 12)}…</td>
              <td className="px-3 py-1.5 text-[var(--color-muted-fg)]">{call.parked_by ?? '—'}</td>
              <td className={`px-3 py-1.5 font-semibold ${parkedCallStatusColor(call.status)}`}>
                {call.status}
              </td>
              <td className="px-3 py-1.5 text-[var(--color-muted-fg)]">{relativeTime(call.parked_at)}</td>
              <td className="px-3 py-1.5 text-[var(--color-muted-fg)]">
                {call.timeout_at ? relativeTime(call.timeout_at) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Lot row ───────────────────────────────────────────────────────────────────

function LotRow({
  lot,
  onDelete,
  deleting,
}: {
  lot: ParkingLot;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className="cursor-pointer hover:bg-[var(--color-surface-muted)]"
        onClick={() => setExpanded(v => !v)}
      >
        <td className="px-3 py-2">
          {expanded
            ? <ChevronDown className="size-4 text-[var(--color-muted-fg)]" aria-hidden="true" />
            : <ChevronRight className="size-4 text-[var(--color-muted-fg)]" aria-hidden="true" />}
        </td>
        <td className="px-3 py-2 font-medium">{lot.name}</td>
        <td className="px-3 py-2 font-mono text-sm text-[var(--color-muted-fg)]">
          {lot.slot_range_start}–{lot.slot_range_end}
        </td>
        <td className="px-3 py-2 text-sm text-[var(--color-muted-fg)]">
          {lot.timeout_seconds}s
        </td>
        <td className="px-3 py-2">
          <StatusBadge status="active" />
        </td>
        <td className="px-3 py-2 text-right">
          <Button
            variant="destructive"
            disabled={deleting}
            onClick={(e) => { e.stopPropagation(); onDelete(lot.id); }}
            aria-label={`Delete ${lot.name}`}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="bg-[var(--color-surface-muted)] px-4 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-fg)]">
              Currently parked calls (auto-refreshes every 10s)
            </p>
            <ParkedCallsPanel lotId={lot.id} />
          </td>
        </tr>
      )}
    </>
  );
}

// ── Create form ───────────────────────────────────────────────────────────────

function CreateLotForm({ onDone }: { onDone: () => void }) {
  const create = useCreateParkingLot();
  const form = useForm<CreateParkingLotBody>({
    defaultValues: { name: '', slot_range_start: 700, slot_range_end: 799, timeout_seconds: 120 },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await create.mutateAsync({
        ...data,
        slot_range_start: Number(data.slot_range_start),
        slot_range_end: Number(data.slot_range_end),
        timeout_seconds: Number(data.timeout_seconds),
      });
      form.reset();
      onDone();
    } catch {
      // error surfaced via create.isError
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-[var(--color-fg)] mb-1">Name *</label>
          <input
            {...form.register('name', { required: true })}
            placeholder="Main parking lot"
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-tenant)]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-fg)] mb-1">
            Timeout (seconds) *
          </label>
          <input
            {...form.register('timeout_seconds', { required: true, valueAsNumber: true })}
            type="number"
            min={10}
            max={3600}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-tenant)]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-fg)] mb-1">
            Slot range start *
          </label>
          <input
            {...form.register('slot_range_start', { required: true, valueAsNumber: true })}
            type="number"
            min={100}
            max={9999}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-tenant)]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--color-fg)] mb-1">
            Slot range end *
          </label>
          <input
            {...form.register('slot_range_end', { required: true, valueAsNumber: true })}
            type="number"
            min={100}
            max={9999}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-tenant)]"
          />
        </div>
      </div>

      {create.isError && (
        <p className="text-sm text-[var(--color-error)]">
          {create.error instanceof Error ? create.error.message : 'Failed to create parking lot.'}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Creating…' : 'Create lot'}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-error)]/30 bg-[var(--color-error)]/5 p-4">
      <p className="text-sm font-medium text-[var(--color-error)]">{title}</p>
      <p className="mt-1 text-xs text-[var(--color-muted-fg)]">{message}</p>
    </div>
  );
}

export function ParkingLotsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const lotsQuery = useParkingLots();
  const deleteLot = useDeleteParkingLot();

  const handleDelete = (lot: ParkingLot) => {
    if (window.confirm(`Delete parking lot "${lot.name}"? This cannot be undone.`)) {
      void deleteLot.mutate(lot.id);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenant Workspace"
        title="Parking Lots"
        description="Manage call parking lots. Callers can park on a slot and be retrieved by dialling the slot number from any extension."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => void lotsQuery.refetch()}>
              <RefreshCcw className="size-4" aria-hidden="true" />
              Refresh
            </Button>
            <Button onClick={() => setShowCreate(v => !v)}>
              <Plus className="size-4" aria-hidden="true" />
              Add lot
            </Button>
          </div>
        }
      />

      {showCreate && (
        <DataCard
          title="New parking lot"
          description="Define a slot range and a ringback timeout for the lot."
        >
          <CreateLotForm onDone={() => setShowCreate(false)} />
        </DataCard>
      )}

      <DataCard
        title="Parking lot inventory"
        description="Click a row to expand and see currently parked calls (auto-refreshes every 10s)."
      >
        {lotsQuery.isLoading ? (
          <p className="text-sm text-[var(--color-muted-fg)]">Loading parking lots…</p>
        ) : lotsQuery.isError ? (
          <ErrorState
            title="Could not load parking lots"
            message={lotsQuery.error instanceof Error ? lotsQuery.error.message : 'Unknown error'}
          />
        ) : !lotsQuery.data || lotsQuery.data.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <PauseCircle className="size-8 text-[var(--color-muted-fg)]" aria-hidden="true" />
            <p className="text-sm text-[var(--color-muted-fg)]">
              No parking lots yet. Add one to enable call parking.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--color-surface-muted)] text-[var(--color-muted-fg)]">
                <tr>
                  <th className="w-6 px-3 py-2" />
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Slot range</th>
                  <th className="px-3 py-2 font-medium">Timeout</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
                {lotsQuery.data.map((lot: ParkingLot) => (
                  <LotRow
                    key={lot.id}
                    lot={lot}
                    onDelete={() => handleDelete(lot)}
                    deleting={deleteLot.isPending && deleteLot.variables === lot.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>
    </div>
  );
}
