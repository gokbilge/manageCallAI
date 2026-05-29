import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Plus, RefreshCcw } from 'lucide-react';
import { useForm } from 'react-hook-form';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { apiRequest, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';

type OutboundRoute = {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  match_prefix: string;
  priority: number;
  sip_trunk_id: string;
  fallback_sip_trunk_id: string | null;
  max_calls_per_minute: number | null;
  created_at: string;
};

type CreateRouteForm = {
  name: string;
  match_prefix: string;
  sip_trunk_id: string;
  priority: number;
};

export function OutboundRoutesPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const form = useForm<CreateRouteForm>({
    defaultValues: { name: '', match_prefix: '', sip_trunk_id: '', priority: 100 },
  });

  const routesQuery = useQuery({
    queryKey: ['outbound-routes', session?.claims.tenant_id],
    enabled: Boolean(session?.token),
    queryFn: async () => {
      const result = await apiRequest<{ data: OutboundRoute[] }>('/outbound-routes', {
        accessToken: session!.token,
      });
      return result.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: CreateRouteForm) =>
      apiRequest<{ data: OutboundRoute }>('/outbound-routes', {
        method: 'POST',
        accessToken: session!.token,
        body: JSON.stringify({
          name: values.name,
          match_prefix: values.match_prefix,
          sip_trunk_id: values.sip_trunk_id,
          priority: Number(values.priority),
        }),
      }),
    onSuccess: async () => {
      form.reset();
      await queryClient.invalidateQueries({ queryKey: ['outbound-routes', session?.claims.tenant_id] });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ data: OutboundRoute }>(`/outbound-routes/${id}/deactivate`, {
        method: 'POST',
        accessToken: session!.token,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['outbound-routes', session?.claims.tenant_id] });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenant Workspace"
        title="Outbound Routes"
        description="Desired-state dial rules that map number prefixes to SIP trunks. The backend selects the best route by longest-prefix match and priority."
        actions={
          <Button onClick={() => routesQuery.refetch()} variant="secondary">
            <RefreshCcw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <DataCard title="Route Inventory" description="Active and inactive outbound routes ordered by priority.">
          {routesQuery.isLoading ? (
            <p className="text-sm text-[var(--color-muted-fg)]">Loading routes...</p>
          ) : routesQuery.isError ? (
            <ErrorState
              title="Could not load outbound routes"
              message={routesQuery.error instanceof Error ? routesQuery.error.message : 'Unknown error'}
            />
          ) : routesQuery.data && routesQuery.data.length > 0 ? (
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--color-surface-muted)] text-[var(--color-muted-fg)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Prefix</th>
                    <th className="px-3 py-2 font-medium">Priority</th>
                    <th className="px-3 py-2 font-medium">Trunk</th>
                    <th className="px-3 py-2 font-medium">Rate cap</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
                  {routesQuery.data.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2 font-medium">
                        <span className="flex items-center gap-2">
                          <ArrowUpRight className="size-3.5 text-[var(--color-muted-fg)]" aria-hidden="true" />
                          {r.name}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{r.match_prefix}</td>
                      <td className="px-3 py-2 text-[var(--color-muted-fg)]">{r.priority}</td>
                      <td className="px-3 py-2 font-mono text-xs text-[var(--color-muted-fg)]">{r.sip_trunk_id.slice(0, 8)}…</td>
                      <td className="px-3 py-2 text-[var(--color-muted-fg)]">
                        {r.max_calls_per_minute ? `${r.max_calls_per_minute}/min` : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-3 py-2">
                        {r.status === 'active' && (
                          <Button
                            variant="secondary"
                            onClick={() => deactivateMutation.mutate(r.id)}
                            disabled={deactivateMutation.isPending}
                          >
                            Deactivate
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No outbound routes yet"
              description="Create an outbound route to define how calls are placed through SIP trunks."
            />
          )}
        </DataCard>

        <DataCard title="Create Route" description="Map a dial prefix to a SIP trunk. The backend uses longest-prefix match then priority to select routes.">
          <form className="space-y-4" onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}>
            <Field label="Name">
              <input className={inputClass} {...form.register('name', { required: true })} />
            </Field>
            <Field label="Match prefix (e.g. +1 or 001)">
              <input className={inputClass} placeholder="+1" {...form.register('match_prefix', { required: true })} />
            </Field>
            <Field label="SIP trunk ID (UUID)">
              <input className={inputClass} {...form.register('sip_trunk_id', { required: true })} />
            </Field>
            <Field label="Priority (lower = higher priority)">
              <input className={inputClass} type="number" min={1} max={9999} {...form.register('priority', { required: true, valueAsNumber: true })} />
            </Field>

            {createMutation.isError ? (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
                {createMutation.error instanceof ApiError ? createMutation.error.message : 'Could not create route'}
              </div>
            ) : null}

            <Button className="w-full" disabled={createMutation.isPending} type="submit">
              <Plus className="size-4" aria-hidden="true" />
              {createMutation.isPending ? 'Creating...' : 'Create Route'}
            </Button>
          </form>
        </DataCard>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
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

const inputClass =
  'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none transition focus:border-[var(--color-focus)] focus:ring-2 focus:ring-[var(--color-focus)]/20';
