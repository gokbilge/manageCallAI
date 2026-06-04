import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Plus, RefreshCcw, Server } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  type CreateSipTrunkBody,
  type GatewayStatusEntry,
  type RuntimeApplyRequest,
  type SipTrunk,
  useCreateSipTrunk,
  useDeactivateSipTrunk,
  useGatewayStatus,
  useSipTrunks,
  useTrunkApplyRequests,
} from '@/lib/sip-trunks/sip-trunks-api';

// ── Helpers ──────────────────────────────────────────────────────────────────

function gatewayStateColor(state: string): string {
  const s = state.toUpperCase();
  if (s === 'REGED') return 'text-[var(--color-success)]';
  if (s === 'DOWN' || s === 'FAILED') return 'text-[var(--color-error)]';
  if (s === 'TRYING' || s === 'REGISTER') return 'text-[var(--color-warning)]';
  return 'text-[var(--color-muted-fg)]';
}

function applyStatusColor(status: string): string {
  if (status === 'applied') return 'text-[var(--color-success)]';
  if (status === 'failed') return 'text-[var(--color-error)]';
  if (status === 'applying') return 'text-[var(--color-warning)]';
  return 'text-[var(--color-muted-fg)]';
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Apply history sub-panel ───────────────────────────────────────────────────

function ApplyHistory({ trunkId }: { trunkId: string }) {
  const q = useTrunkApplyRequests(trunkId);

  if (q.isLoading) {
    return <p className="text-xs text-[var(--color-muted-fg)]">Loading apply history…</p>;
  }
  if (q.isError || !q.data) {
    return <p className="text-xs text-[var(--color-error)]">Could not load apply history.</p>;
  }
  if (q.data.length === 0) {
    return <p className="text-xs text-[var(--color-muted-fg)]">No apply requests yet.</p>;
  }

  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)]">
      <table className="w-full text-left text-xs">
        <thead className="bg-[var(--color-surface-muted)] text-[var(--color-muted-fg)]">
          <tr>
            <th className="px-3 py-1.5 font-medium">ID</th>
            <th className="px-3 py-1.5 font-medium">Action</th>
            <th className="px-3 py-1.5 font-medium">Node</th>
            <th className="px-3 py-1.5 font-medium">Status</th>
            <th className="px-3 py-1.5 font-medium">Active calls</th>
            <th className="px-3 py-1.5 font-medium">Result</th>
            <th className="px-3 py-1.5 font-medium">Age</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
          {q.data.map((req: RuntimeApplyRequest) => (
            <tr key={req.id}>
              <td className="px-3 py-1.5 font-mono">{shortId(req.id)}</td>
              <td className="px-3 py-1.5 font-mono">{req.action_type}</td>
              <td className="px-3 py-1.5 font-mono">{shortId(req.target_node_id)}</td>
              <td className={`px-3 py-1.5 font-semibold ${applyStatusColor(req.status)}`}>
                {req.status}
              </td>
              <td className="px-3 py-1.5">
                {req.active_call_count != null && req.active_call_count > 0 ? (
                  <span className="inline-flex items-center gap-1 text-[var(--color-warning)]">
                    <AlertTriangle className="size-3" aria-hidden="true" />
                    {req.active_call_count}
                  </span>
                ) : (
                  <span className="text-[var(--color-muted-fg)]">{req.active_call_count ?? '—'}</span>
                )}
              </td>
              <td className="px-3 py-1.5 text-[var(--color-muted-fg)]">
                {req.error_message ? (
                  <span className="text-[var(--color-error)]" title={req.error_message}>
                    {req.error_message.slice(0, 40)}{req.error_message.length > 40 ? '…' : ''}
                  </span>
                ) : req.applied_at ? (
                  <span className="text-[var(--color-success)]">applied {relativeTime(req.applied_at)}</span>
                ) : '—'}
              </td>
              <td className="px-3 py-1.5 text-[var(--color-muted-fg)]">{relativeTime(req.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Trunk row ─────────────────────────────────────────────────────────────────

function TrunkRow({
  trunk,
  gatewayEntries,
  onDeactivate,
  deactivating,
}: {
  trunk: SipTrunk;
  gatewayEntries: GatewayStatusEntry[];
  onDeactivate: (id: string) => void;
  deactivating: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const latestGw = gatewayEntries[0];

  return (
    <>
      <tr className="cursor-pointer hover:bg-[var(--color-surface-muted)]" onClick={() => setExpanded(v => !v)}>
        <td className="px-3 py-2">
          {expanded
            ? <ChevronDown className="size-4 text-[var(--color-muted-fg)]" aria-hidden="true" />
            : <ChevronRight className="size-4 text-[var(--color-muted-fg)]" aria-hidden="true" />}
        </td>
        <td className="px-3 py-2 font-medium">{trunk.name}</td>
        <td className="px-3 py-2">
          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-[var(--color-surface-muted)] text-[var(--color-muted-fg)]">
            {trunk.direction}
          </span>
        </td>
        <td className="px-3 py-2 font-mono text-xs text-[var(--color-muted-fg)]">{trunk.realm}</td>
        <td className="px-3 py-2 font-mono text-xs text-[var(--color-muted-fg)]">{trunk.proxy}:{trunk.port}</td>
        <td className="px-3 py-2">
          <StatusBadge status={trunk.status} />
        </td>
        <td className="px-3 py-2">
          {latestGw ? (
            <span className={`text-xs font-semibold ${gatewayStateColor(latestGw.state)}`}>
              {latestGw.state}
            </span>
          ) : (
            <span className="text-xs text-[var(--color-muted-fg)]">no data</span>
          )}
        </td>
        <td className="px-3 py-2 text-right">
          {trunk.status === 'active' && (
            <Button
              variant="destructive"
              disabled={deactivating}
              onClick={(e) => { e.stopPropagation(); onDeactivate(trunk.id); }}
            >
              Deactivate
            </Button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8} className="bg-[var(--color-surface-muted)] px-4 py-4">
            <div className="space-y-4">
              {/* Gateway state details */}
              {gatewayEntries.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-fg)]">
                    Gateway state across nodes
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {gatewayEntries.map((gw) => (
                      <div
                        key={`${gw.node_id}-${gw.trunk_id}`}
                        className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs"
                      >
                        <p className="font-mono text-[var(--color-muted-fg)]">node {shortId(gw.node_id)}</p>
                        <p className={`mt-0.5 font-semibold ${gatewayStateColor(gw.state)}`}>{gw.state}</p>
                        <p className="mt-0.5 text-[var(--color-muted-fg)]">
                          polled {relativeTime(gw.queried_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Apply request history */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-fg)]">
                  Apply request history
                </p>
                <ApplyHistory trunkId={trunk.id} />
              </div>

              {/* Trunk details */}
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs sm:grid-cols-4">
                {[
                  ['Transport', trunk.transport.toUpperCase()],
                  ['DTMF', trunk.dtmf_mode],
                  ['SRTP', trunk.srtp_policy],
                  ['Auth user', trunk.auth_username],
                ].map(([label, value]) => (
                  <div key={label}>
                    <span className="text-[var(--color-muted-fg)]">{label}: </span>
                    <span className="font-mono">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Create form ───────────────────────────────────────────────────────────────

function CreateTrunkForm({ onDone }: { onDone: () => void }) {
  const create = useCreateSipTrunk();
  const form = useForm<CreateSipTrunkBody>({
    defaultValues: {
      name: '',
      direction: 'bidirectional',
      realm: '',
      proxy: '',
      auth_username: '',
      auth_password: '',
      transport: 'udp',
      srtp_policy: 'optional',
    },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    await create.mutateAsync(data);
    form.reset();
    onDone();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-fg)] mb-1">Name *</label>
          <input
            {...form.register('name', { required: true })}
            placeholder="Carrier trunk"
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-tenant)]"
          />
        </div>
        {/* Direction */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-fg)] mb-1">Direction *</label>
          <select
            {...form.register('direction')}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-tenant)]"
          >
            <option value="bidirectional">Bidirectional</option>
            <option value="inbound">Inbound only</option>
            <option value="outbound">Outbound only</option>
          </select>
        </div>
        {/* Realm */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-fg)] mb-1">Realm (SIP domain) *</label>
          <input
            {...form.register('realm', { required: true })}
            placeholder="sip.carrier.com"
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-tenant)]"
          />
        </div>
        {/* Proxy */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-fg)] mb-1">Proxy host *</label>
          <input
            {...form.register('proxy', { required: true })}
            placeholder="sip.carrier.com"
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-tenant)]"
          />
        </div>
        {/* Auth username */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-fg)] mb-1">Auth username *</label>
          <input
            {...form.register('auth_username', { required: true })}
            placeholder="trunkuser"
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-tenant)]"
          />
        </div>
        {/* Auth password */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-fg)] mb-1">Auth password *</label>
          <input
            {...form.register('auth_password', { required: true })}
            type="password"
            placeholder="••••••••"
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-tenant)]"
          />
        </div>
        {/* Transport */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-fg)] mb-1">Transport</label>
          <select
            {...form.register('transport')}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-tenant)]"
          >
            <option value="udp">UDP</option>
            <option value="tcp">TCP</option>
            <option value="tls">TLS</option>
          </select>
        </div>
        {/* SRTP */}
        <div>
          <label className="block text-xs font-medium text-[var(--color-fg)] mb-1">SRTP policy</label>
          <select
            {...form.register('srtp_policy')}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-tenant)]"
          >
            <option value="disabled">Disabled</option>
            <option value="optional">Optional</option>
            <option value="required">Required</option>
          </select>
        </div>
      </div>

      {create.isError && (
        <p className="text-sm text-[var(--color-error)]">
          {create.error instanceof Error ? create.error.message : 'Failed to create trunk.'}
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? 'Creating…' : 'Create trunk'}
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

export function SipTrunksPage() {
  const [showCreate, setShowCreate] = useState(false);
  const trunksQuery = useSipTrunks();
  const gwQuery = useGatewayStatus();
  const deactivate = useDeactivateSipTrunk();

  const gwByTrunk = (gwQuery.data ?? []).reduce<Record<string, GatewayStatusEntry[]>>((acc, e) => {
    (acc[e.trunk_id] ??= []).push(e);
    return acc;
  }, {});

  const handleDeactivate = (trunkId: string) => {
    const entries = gwByTrunk[trunkId] ?? [];
    const hasActiveGw = entries.some(e => e.state === 'REGED');
    const msg = hasActiveGw
      ? 'This trunk has an active gateway registration. Deactivating will trigger a rescan and may disrupt calls in progress. Continue?'
      : 'Deactivate this trunk? A gateway rescan will be triggered on all nodes.';
    if (window.confirm(msg)) {
      void deactivate.mutate(trunkId);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenant Workspace"
        title="SIP Trunks"
        description="Carrier trunks connected to FreeSWITCH via sofia. Each change triggers a safe gateway rescan on all active nodes."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => { void trunksQuery.refetch(); void gwQuery.refetch(); }}>
              <RefreshCcw className="size-4" aria-hidden="true" />
              Refresh
            </Button>
            <Button onClick={() => setShowCreate(v => !v)}>
              <Plus className="size-4" aria-hidden="true" />
              Add trunk
            </Button>
          </div>
        }
      />

      {showCreate && (
        <DataCard title="New SIP trunk" description="Fill in carrier credentials. A gateway registration will be attempted immediately on save.">
          <CreateTrunkForm onDone={() => setShowCreate(false)} />
        </DataCard>
      )}

      <DataCard
        title="Trunk inventory"
        description="Click a row to expand apply request history and per-node gateway state."
      >
        {trunksQuery.isLoading ? (
          <p className="text-sm text-[var(--color-muted-fg)]">Loading trunks…</p>
        ) : trunksQuery.isError ? (
          <ErrorState
            title="Could not load trunks"
            message={trunksQuery.error instanceof Error ? trunksQuery.error.message : 'Unknown error'}
          />
        ) : !trunksQuery.data || trunksQuery.data.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Server className="size-8 text-[var(--color-muted-fg)]" aria-hidden="true" />
            <p className="text-sm text-[var(--color-muted-fg)]">No trunks yet. Add one to connect a carrier.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--color-surface-muted)] text-[var(--color-muted-fg)]">
                <tr>
                  <th className="w-6 px-3 py-2" />
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Direction</th>
                  <th className="px-3 py-2 font-medium">Realm</th>
                  <th className="px-3 py-2 font-medium">Proxy</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Gateway</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
                {trunksQuery.data.map((trunk: SipTrunk) => (
                  <TrunkRow
                    key={trunk.id}
                    trunk={trunk}
                    gatewayEntries={gwByTrunk[trunk.id] ?? []}
                    onDeactivate={handleDeactivate}
                    deactivating={deactivate.isPending && deactivate.variables === trunk.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>

      {gwQuery.isError && (
        <p className="text-xs text-[var(--color-muted-fg)]">
          Gateway status unavailable (no node snapshots yet).
        </p>
      )}
    </div>
  );
}
