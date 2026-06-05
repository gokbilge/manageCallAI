import { useState } from 'react';
import { RefreshCcw, ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';

type AuditLogEntry = {
  id: string;
  tenant_id: string | null;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const RESOURCE_TYPES = [
  'all',
  'sip_trunk', 'extension', 'inbound_route', 'outbound_route',
  'ivr_flow', 'feature_code', 'parking_lot', 'conference_room',
  'outbound_call', 'recording', 'user',
];

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

function actionColor(action: string): string {
  if (action.includes('.created') || action.includes('.published')) return 'text-[var(--color-success)]';
  if (action.includes('.deleted') || action.includes('.deactivated') || action.includes('.blocked')) return 'text-[var(--color-error)]';
  if (action.includes('.updated') || action.includes('.patched')) return 'text-[var(--color-warning)]';
  return 'text-[var(--color-muted-fg)]';
}

export function AuditLogPage() {
  const { session } = useAuth();
  const [resourceType, setResourceType] = useState('all');
  const [actionFilter, setActionFilter] = useState('');

  const q = useQuery({
    queryKey: ['audit-log', session?.claims.tenant_id, resourceType, actionFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '100' });
      if (resourceType !== 'all') params.set('resource_type', resourceType);
      if (actionFilter.trim()) params.set('action', actionFilter.trim());
      const r = await apiRequest<{ data: AuditLogEntry[] }>(
        `/audit?${params.toString()}`,
        { accessToken: session?.token },
      );
      return r.data;
    },
    enabled: Boolean(session?.token),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenant Workspace"
        title="Audit Log"
        description="Immutable record of all lifecycle events for this tenant. Events are written at action time and cannot be modified."
        actions={
          <Button variant="secondary" onClick={() => void q.refetch()}>
            <RefreshCcw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <DataCard title="Filters" description="Narrow events by resource type or action name.">
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--color-muted-fg)] mb-1">Resource type</label>
            <select
              value={resourceType}
              onChange={e => setResourceType(e.target.value)}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-tenant)]"
            >
              {RESOURCE_TYPES.map(t => (
                <option key={t} value={t}>{t === 'all' ? 'All types' : t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-muted-fg)] mb-1">Action contains</label>
            <input
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              placeholder="e.g. created, blocked"
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-tenant)]"
            />
          </div>
        </div>
      </DataCard>

      <DataCard
        title="Events"
        description={`Last 100 events${resourceType !== 'all' ? ` for ${resourceType.replace(/_/g, ' ')}` : ''}.`}
      >
        {q.isLoading ? (
          <p className="text-sm text-[var(--color-muted-fg)]">Loading audit log…</p>
        ) : q.isError ? (
          <p className="text-sm text-[var(--color-error)]">Could not load audit log.</p>
        ) : !q.data || q.data.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <ShieldCheck className="size-8 text-[var(--color-muted-fg)]" aria-hidden="true" />
            <p className="text-sm text-[var(--color-muted-fg)]">No events match the current filters.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--color-surface-muted)] text-[var(--color-muted-fg)]">
                <tr>
                  <th className="px-3 py-1.5 font-medium">Time</th>
                  <th className="px-3 py-1.5 font-medium">Action</th>
                  <th className="px-3 py-1.5 font-medium">Resource</th>
                  <th className="px-3 py-1.5 font-medium">Actor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
                {q.data.map(entry => (
                  <tr key={entry.id}>
                    <td className="px-3 py-1.5 text-[var(--color-muted-fg)] whitespace-nowrap">
                      {relativeTime(entry.created_at)}
                    </td>
                    <td className={`px-3 py-1.5 font-mono font-semibold ${actionColor(entry.action)}`}>
                      {entry.action}
                    </td>
                    <td className="px-3 py-1.5 text-[var(--color-muted-fg)]">
                      {entry.resource_type ? (
                        <span>
                          <span className="font-medium text-[var(--color-fg)]">{entry.resource_type.replace(/_/g, ' ')}</span>
                          {entry.resource_id && (
                            <span className="font-mono ml-1 opacity-60">{entry.resource_id.slice(0, 8)}…</span>
                          )}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-[var(--color-muted-fg)]">
                      {entry.actor_role ? (
                        <span className="font-medium">{entry.actor_role}</span>
                      ) : '—'}
                      {entry.actor_id && (
                        <span className="ml-1 font-mono opacity-60">{entry.actor_id.slice(0, 8)}…</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataCard>
    </div>
  );
}
