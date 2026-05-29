import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Plus, RefreshCcw } from 'lucide-react';
import { useForm } from 'react-hook-form';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { apiRequest, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';

type Schedule = {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  timezone: string;
  weekly_rules_json: unknown[];
  holiday_overrides_json: unknown[];
  created_at: string;
};

type CreateScheduleForm = {
  name: string;
  timezone: string;
};

export function SchedulesPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const form = useForm<CreateScheduleForm>({
    defaultValues: { name: '', timezone: 'UTC' },
  });

  const schedulesQuery = useQuery({
    queryKey: ['schedules', session?.claims.tenant_id],
    enabled: Boolean(session?.token),
    queryFn: async () => {
      const result = await apiRequest<{ data: Schedule[] }>('/schedules', {
        accessToken: session!.token,
      });
      return result.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: CreateScheduleForm) =>
      apiRequest<{ data: Schedule }>('/schedules', {
        method: 'POST',
        accessToken: session!.token,
        body: JSON.stringify({ name: values.name, timezone: values.timezone }),
      }),
    onSuccess: async () => {
      form.reset();
      await queryClient.invalidateQueries({ queryKey: ['schedules', session?.claims.tenant_id] });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ data: Schedule }>(`/schedules/${id}/deactivate`, {
        method: 'POST',
        accessToken: session!.token,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['schedules', session?.claims.tenant_id] });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenant Workspace"
        title="Schedules"
        description="Business-hours schedules referenced by IVR flows. Define weekly windows and holiday overrides to route calls based on time."
        actions={
          <Button onClick={() => schedulesQuery.refetch()} variant="secondary">
            <RefreshCcw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <DataCard title="Schedule Inventory" description="All schedules for this tenant.">
          {schedulesQuery.isLoading ? (
            <p className="text-sm text-[var(--color-muted-fg)]">Loading schedules...</p>
          ) : schedulesQuery.isError ? (
            <ErrorState
              title="Could not load schedules"
              message={schedulesQuery.error instanceof Error ? schedulesQuery.error.message : 'Unknown error'}
            />
          ) : schedulesQuery.data && schedulesQuery.data.length > 0 ? (
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--color-surface-muted)] text-[var(--color-muted-fg)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Timezone</th>
                    <th className="px-3 py-2 font-medium">Weekly rules</th>
                    <th className="px-3 py-2 font-medium">Holiday overrides</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
                  {schedulesQuery.data.map((s) => (
                    <tr key={s.id}>
                      <td className="px-3 py-2 font-medium">
                        <span className="flex items-center gap-2">
                          <CalendarClock className="size-3.5 text-[var(--color-muted-fg)]" aria-hidden="true" />
                          {s.name}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-[var(--color-muted-fg)]">{s.timezone}</td>
                      <td className="px-3 py-2 text-[var(--color-muted-fg)]">{s.weekly_rules_json.length} rule(s)</td>
                      <td className="px-3 py-2 text-[var(--color-muted-fg)]">{s.holiday_overrides_json.length} override(s)</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="px-3 py-2">
                        {s.status === 'active' && (
                          <Button
                            variant="secondary"
                            onClick={() => deactivateMutation.mutate(s.id)}
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
              title="No schedules yet"
              description="Create a schedule to enable business-hours routing in IVR flows."
            />
          )}
        </DataCard>

        <DataCard title="Create Schedule" description="Define a named schedule with a timezone. Add weekly rules and holiday overrides via PATCH after creation.">
          <form className="space-y-4" onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}>
            <Field label="Name">
              <input className={inputClass} {...form.register('name', { required: true })} />
            </Field>
            <Field label="Timezone (IANA)">
              <input className={inputClass} placeholder="America/New_York" {...form.register('timezone', { required: true })} />
            </Field>

            {createMutation.isError ? (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
                {createMutation.error instanceof ApiError ? createMutation.error.message : 'Could not create schedule'}
              </div>
            ) : null}

            <Button className="w-full" disabled={createMutation.isPending} type="submit">
              <Plus className="size-4" aria-hidden="true" />
              {createMutation.isPending ? 'Creating...' : 'Create Schedule'}
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
