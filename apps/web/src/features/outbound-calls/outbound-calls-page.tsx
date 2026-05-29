import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Phone, Plus, RefreshCcw } from 'lucide-react';
import { useForm } from 'react-hook-form';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { apiRequest, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';

type OutboundCallRequest = {
  id: string;
  extension_id: string;
  dial_number: string;
  route_id: string | null;
  sip_trunk_id: string | null;
  status: 'pending' | 'dispatched' | 'answered' | 'completed' | 'failed' | 'expired';
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
};

type CreateCallForm = {
  extension_id: string;
  dial_number: string;
  route_id?: string;
};

export function OutboundCallsPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const form = useForm<CreateCallForm>({
    defaultValues: { extension_id: '', dial_number: '', route_id: '' },
  });

  const callsQuery = useQuery({
    queryKey: ['outbound-calls', session?.claims.tenant_id],
    enabled: Boolean(session?.token),
    queryFn: async () => {
      const result = await apiRequest<{ data: OutboundCallRequest[] }>('/runtime/outbound', {
        accessToken: session!.token,
      });
      return result.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: CreateCallForm) =>
      apiRequest<{ data: OutboundCallRequest }>('/runtime/outbound', {
        method: 'POST',
        accessToken: session!.token,
        body: JSON.stringify({
          extension_id: values.extension_id,
          dial_number: values.dial_number,
          ...(values.route_id ? { route_id: values.route_id } : {}),
        }),
      }),
    onSuccess: async () => {
      form.reset();
      await queryClient.invalidateQueries({ queryKey: ['outbound-calls', session?.claims.tenant_id] });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenant Workspace"
        title="Outbound Calls"
        description="Create click-to-call requests and track their execution status through the FreeSWITCH runtime."
        actions={
          <Button onClick={() => callsQuery.refetch()} variant="secondary">
            <RefreshCcw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <DataCard title="Call Requests" description="Recent outbound call requests ordered by creation time.">
          {callsQuery.isLoading ? (
            <p className="text-sm text-[var(--color-muted-fg)]">Loading call requests...</p>
          ) : callsQuery.isError ? (
            <ErrorState
              title="Could not load outbound calls"
              message={callsQuery.error instanceof Error ? callsQuery.error.message : 'Unknown error'}
            />
          ) : callsQuery.data && callsQuery.data.length > 0 ? (
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--color-surface-muted)] text-[var(--color-muted-fg)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Dial Number</th>
                    <th className="px-3 py-2 font-medium">Extension</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
                  {callsQuery.data.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2 font-mono text-xs">
                        <span className="flex items-center gap-2">
                          <Phone className="size-3.5 text-[var(--color-muted-fg)]" aria-hidden="true" />
                          {r.dial_number}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-[var(--color-muted-fg)]">
                        {r.extension_id.slice(0, 8)}…
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={r.status} />
                        {r.failure_reason && (
                          <span className="ml-2 text-xs text-[var(--color-danger)]">{r.failure_reason}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-[var(--color-muted-fg)]">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No outbound call requests yet"
              description="Create an outbound call request to initiate a click-to-call workflow."
            />
          )}
        </DataCard>

        <DataCard title="New Call Request" description="Initiate an outbound call through a registered extension. The runtime agent will claim and dispatch it.">
          <form className="space-y-4" onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}>
            <Field label="Extension ID (UUID)">
              <input
                className={inputClass}
                placeholder="Extension UUID"
                {...form.register('extension_id', { required: true })}
              />
            </Field>
            <Field label="Dial Number">
              <input
                className={inputClass}
                placeholder="+905551234567"
                {...form.register('dial_number', { required: true })}
              />
            </Field>
            <Field label="Route ID (optional UUID)">
              <input
                className={inputClass}
                placeholder="Leave blank for auto-resolved route"
                {...form.register('route_id')}
              />
            </Field>

            {createMutation.isError ? (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
                {createMutation.error instanceof ApiError ? createMutation.error.message : 'Could not create call request'}
              </div>
            ) : null}

            <Button className="w-full" disabled={createMutation.isPending} type="submit">
              <Plus className="size-4" aria-hidden="true" />
              {createMutation.isPending ? 'Creating...' : 'Create Call Request'}
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
