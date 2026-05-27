import type { ReactNode } from 'react';
import { Plus, RefreshCcw } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { ApiError } from '@/lib/api/client';
import { usePhoneNumbers, useCreatePhoneNumber, useDeactivatePhoneNumber } from '@/lib/phone-numbers/phone-numbers-api';

type CreateNumberForm = {
  e164_number: string;
  display_label: string;
};

export function NumbersPage() {
  const numbersQuery = usePhoneNumbers();
  const createNumber = useCreatePhoneNumber();
  const deactivateNumber = useDeactivatePhoneNumber();
  const form = useForm<CreateNumberForm>({
    defaultValues: { e164_number: '', display_label: '' },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenant Workspace"
        title="Phone Numbers"
        description="DID inventory: numbers are the first hop of inbound call routing. Assign a number to an inbound route after creating it."
        actions={
          <Button onClick={() => numbersQuery.refetch()} variant="secondary">
            <RefreshCcw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <DataCard title="Number Inventory" description="E.164 DIDs scoped to this tenant.">
          {numbersQuery.isLoading ? (
            <p className="text-sm text-[var(--color-muted-fg)]">Loading numbers...</p>
          ) : numbersQuery.isError ? (
            <ErrorState
              title="Could not load phone numbers"
              message={numbersQuery.error instanceof Error ? numbersQuery.error.message : 'Unknown error'}
            />
          ) : numbersQuery.data && numbersQuery.data.length > 0 ? (
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--color-surface-muted)] text-[var(--color-muted-fg)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">E.164 Number</th>
                    <th className="px-3 py-2 font-medium">Label</th>
                    <th className="px-3 py-2 font-medium">Assigned Target</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
                  {numbersQuery.data.map((num) => (
                    <tr key={num.id}>
                      <td className="px-3 py-2 font-mono text-xs">{num.e164_number}</td>
                      <td className="px-3 py-2 text-[var(--color-muted-fg)]">{num.display_label ?? '—'}</td>
                      <td className="px-3 py-2 text-xs text-[var(--color-muted-fg)]">
                        {num.assigned_target_type
                          ? `${num.assigned_target_type}: ${num.assigned_target_id ?? 'unset'}`
                          : 'Unassigned'}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={num.status} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        {num.status === 'active' && (
                          <Button
                            variant="secondary"
                            disabled={deactivateNumber.isPending}
                            onClick={() => void deactivateNumber.mutateAsync(num.id)}
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
              title="No phone numbers yet"
              description="Add a DID to start building inbound call routing. Numbers are the entry point into the routing desired-state model."
            />
          )}
        </DataCard>

        <DataCard title="Add Phone Number" description="Register a DID in E.164 format (+CountryAreaLocal).">
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) =>
              createNumber.mutate({
                e164_number: values.e164_number,
                display_label: values.display_label || undefined,
              }, { onSuccess: () => form.reset() }),
            )}
          >
            <Field label="E.164 number (required)">
              <input
                className={inputCls}
                placeholder="+905551234567"
                {...form.register('e164_number', { required: true })}
              />
            </Field>
            <Field label="Display label (optional)">
              <input
                className={inputCls}
                placeholder="Main sales line"
                {...form.register('display_label')}
              />
            </Field>

            {createNumber.isError && (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
                {createNumber.error instanceof ApiError ? createNumber.error.message : 'Could not create phone number'}
              </div>
            )}

            <Button className="w-full" disabled={createNumber.isPending} type="submit">
              <Plus className="size-4" aria-hidden="true" />
              {createNumber.isPending ? 'Adding...' : 'Add Number'}
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
