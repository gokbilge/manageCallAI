import type { ReactNode } from 'react';
import { Plus, RefreshCcw } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { apiRequest, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';
import {
  useInboundRoutes,
  useCreateInboundRoute,
  useActivateRoute,
  useDeactivateRoute,
} from '@/lib/inbound-routes/inbound-routes-api';

type Extension = {
  id: string;
  extension_number: string;
  display_name: string;
  status: 'active' | 'inactive';
};

type CreateRouteForm = {
  name: string;
  match_value: string;
  target_id: string;
};

export function InboundRoutesPage() {
  const { session } = useAuth();
  const routesQuery = useInboundRoutes();
  const createRoute = useCreateInboundRoute();
  const activateRoute = useActivateRoute();
  const deactivateRoute = useDeactivateRoute();
  const form = useForm<CreateRouteForm>({
    defaultValues: { name: '', match_value: '', target_id: '' },
  });

  const extensionsQuery = useQuery({
    queryKey: ['extensions', session?.claims.tenant_id],
    enabled: Boolean(session?.token),
    queryFn: async () => {
      const r = await apiRequest<{ data: Extension[] }>('/extensions', { accessToken: session!.token });
      return r.data;
    },
  });

  const activeExtensions = extensionsQuery.data?.filter((e) => e.status === 'active') ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenant Workspace"
        title="Inbound Routes"
        description="Route incoming DIDs to extension targets. A route must be activated before FreeSWITCH can match it."
        actions={
          <Button onClick={() => routesQuery.refetch()} variant="secondary">
            <RefreshCcw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <DataCard title="Route Inventory" description="Active routes are projected to FreeSWITCH dialplan via mod_xml_curl.">
          {routesQuery.isLoading ? (
            <p className="text-sm text-[var(--color-muted-fg)]">Loading routes...</p>
          ) : routesQuery.isError ? (
            <ErrorState
              title="Could not load inbound routes"
              message={routesQuery.error instanceof Error ? routesQuery.error.message : 'Unknown error'}
            />
          ) : routesQuery.data && routesQuery.data.length > 0 ? (
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--color-surface-muted)] text-[var(--color-muted-fg)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">DID (match)</th>
                    <th className="px-3 py-2 font-medium">Target</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
                  {routesQuery.data.map((route) => (
                    <tr key={route.id}>
                      <td className="px-3 py-2 font-medium">{route.name}</td>
                      <td className="px-3 py-2 font-mono text-xs">{route.match_value}</td>
                      <td className="px-3 py-2 text-xs text-[var(--color-muted-fg)]">
                        {route.target_type}: {route.target_id ?? 'unset'}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={route.status} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {route.status === 'draft' || route.status === 'inactive' ? (
                            <Button
                              variant="secondary"
                              disabled={activateRoute.isPending}
                              onClick={() => void activateRoute.mutateAsync(route.id)}
                            >
                              Activate
                            </Button>
                          ) : null}
                          {route.status === 'active' ? (
                            <Button
                              variant="secondary"
                              disabled={deactivateRoute.isPending}
                              onClick={() => void deactivateRoute.mutateAsync(route.id)}
                            >
                              Deactivate
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No inbound routes yet"
              description="Create a route to bind a DID to an extension. Activating the route makes it live in the FreeSWITCH dialplan."
            />
          )}
        </DataCard>

        <DataCard title="Create Route" description="Routes start in draft — activate to make them live.">
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) =>
              createRoute.mutate(
                {
                  name: values.name,
                  match_type: 'did',
                  match_value: values.match_value,
                  target_type: 'extension',
                  target_id: values.target_id || undefined,
                },
                { onSuccess: () => form.reset() },
              ),
            )}
          >
            <Field label="Route name (required)">
              <input
                className={inputCls}
                placeholder="Main line → reception"
                {...form.register('name', { required: true })}
              />
            </Field>
            <Field label="DID / match value (required)">
              <input
                className={inputCls}
                placeholder="+905551234567"
                {...form.register('match_value', { required: true })}
              />
            </Field>
            <Field label="Target extension (required)">
              <select
                className={inputCls}
                {...form.register('target_id', { required: true })}
              >
                <option value="">— select extension —</option>
                {activeExtensions.map((ext) => (
                  <option key={ext.id} value={ext.id}>
                    {ext.extension_number} — {ext.display_name}
                  </option>
                ))}
              </select>
              {extensionsQuery.isLoading && (
                <p className="mt-1 text-xs text-[var(--color-muted-fg)]">Loading extensions...</p>
              )}
              {activeExtensions.length === 0 && !extensionsQuery.isLoading && (
                <p className="mt-1 text-xs text-[var(--color-warning)]">No active extensions. Create one first.</p>
              )}
            </Field>

            {createRoute.isError && (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
                {createRoute.error instanceof ApiError ? createRoute.error.message : 'Could not create route'}
              </div>
            )}

            <Button className="w-full" disabled={createRoute.isPending} type="submit">
              <Plus className="size-4" aria-hidden="true" />
              {createRoute.isPending ? 'Creating...' : 'Create Route'}
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

const inputCls =
  'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none transition focus:border-[var(--color-focus)] focus:ring-2 focus:ring-[var(--color-focus)]/20';
