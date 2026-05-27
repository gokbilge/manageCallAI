import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCcw, Workflow } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { ApiError } from '@/lib/api/client';
import { useCreateIvrFlow, useIvrFlows, type IvrFlow } from '@/lib/ivr-flows/ivr-flows-api';
import { paths } from '@/lib/routes/paths';

type CreateFlowForm = {
  name: string;
  description?: string;
};

export function IvrFlowsPage() {
  const queryClient = useQueryClient();
  const flowsQuery = useIvrFlows();
  const createFlow = useCreateIvrFlow();
  const form = useForm<CreateFlowForm>({
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ivr-flows'] });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenant Workspace"
        title="IVR Flows"
        description="Desired-state call flows stay draft-first. Validate before publish, and keep rollback visible."
        actions={(
          <Button onClick={() => void refreshMutation.mutateAsync()} variant="secondary">
            <RefreshCcw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        )}
      />

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <DataCard title="Flow Inventory" description="Tenant-scoped IVR flows and their current draft or active lifecycle state.">
          {flowsQuery.isLoading ? (
            <p className="text-sm text-[var(--color-muted-fg)]">Loading IVR flows...</p>
          ) : flowsQuery.isError ? (
            <ErrorState
              title="Could not load IVR flows"
              message={flowsQuery.error instanceof Error ? flowsQuery.error.message : 'Unknown error'}
            />
          ) : flowsQuery.data && flowsQuery.data.length > 0 ? (
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--color-surface-muted)] text-[var(--color-muted-fg)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Flow</th>
                    <th className="px-3 py-2 font-medium">Description</th>
                    <th className="px-3 py-2 font-medium">Draft Version</th>
                    <th className="px-3 py-2 font-medium">Active Version</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
                  {flowsQuery.data.map((flow) => (
                    <FlowRow key={flow.id} flow={flow} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No IVR flows yet"
              description="Create your first draft flow now. Open the flow detail page to edit it visually, validate it, and simulate it."
            />
          )}
        </DataCard>

        <DataCard title="Create IVR Flow" description="Creates a flow and an initial draft version with a minimal start→hangup graph when none is supplied.">
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit(async (values) => {
              await createFlow.mutateAsync({
                name: values.name,
                description: values.description || undefined,
              });
              form.reset();
            })}
          >
            <Field label="Flow name">
              <input className={inputClassName} {...form.register('name', { required: true })} />
            </Field>
            <Field label="Description">
              <textarea className={inputClassName} rows={4} {...form.register('description')} />
            </Field>
            {createFlow.isError ? (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
                {createFlow.error instanceof ApiError ? createFlow.error.message : 'Could not create IVR flow'}
              </div>
            ) : null}
            <Button className="w-full" disabled={createFlow.isPending} type="submit">
              <Plus className="size-4" aria-hidden="true" />
              {createFlow.isPending ? 'Creating...' : 'Create IVR Flow'}
            </Button>
          </form>
        </DataCard>
      </div>
    </div>
  );
}

function FlowRow({ flow }: { flow: IvrFlow }) {
  return (
    <tr>
      <td className="px-3 py-2">
        <Link className="font-medium text-[var(--color-tenant)] hover:underline" to={`${paths.tenant.ivrFlows}/${flow.id}`}>
          <span className="inline-flex items-center gap-2">
            <Workflow className="size-4" aria-hidden="true" />
            {flow.name}
          </span>
        </Link>
      </td>
      <td className="px-3 py-2 text-[var(--color-muted-fg)]">{flow.description ?? 'No description'}</td>
      <td className="px-3 py-2 font-mono text-xs text-[var(--color-muted-fg)]">{flow.draft_version_id ?? 'none'}</td>
      <td className="px-3 py-2 font-mono text-xs text-[var(--color-muted-fg)]">{flow.active_version_id ?? 'none'}</td>
      <td className="px-3 py-2">
        <StatusBadge status={flow.status} />
      </td>
    </tr>
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

const inputClassName =
  'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none transition focus:border-[var(--color-focus)] focus:ring-2 focus:ring-[var(--color-focus)]/20';
