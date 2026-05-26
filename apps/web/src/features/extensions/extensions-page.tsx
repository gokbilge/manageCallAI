import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCcw, ShieldCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { apiRequest, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';

type Extension = {
  id: string;
  tenant_id: string;
  extension_number: string;
  display_name: string;
  status: 'active' | 'inactive';
  sip_username: string;
  default_destination_type: string | null;
  default_destination_id: string | null;
  created_at: string;
  updated_at: string;
};

type ExtensionListResponse = {
  data: Extension[];
};

type CreateExtensionForm = {
  extension_number: string;
  display_name: string;
  sip_username?: string;
  sip_password: string;
};

export function ExtensionsPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const form = useForm<CreateExtensionForm>({
    defaultValues: {
      extension_number: '',
      display_name: '',
      sip_username: '',
      sip_password: '',
    },
  });

  const extensionsQuery = useQuery({
    queryKey: ['extensions', session?.claims.tenant_id],
    enabled: Boolean(session?.token),
    queryFn: async () => {
      const result = await apiRequest<ExtensionListResponse>('/extensions', {
        accessToken: session!.token,
      });
      return result.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: CreateExtensionForm) =>
      apiRequest<{ data: Extension }>('/extensions', {
        method: 'POST',
        accessToken: session!.token,
        body: JSON.stringify({
          extension_number: values.extension_number,
          display_name: values.display_name,
          sip_username: values.sip_username || undefined,
          sip_password: values.sip_password,
        }),
      }),
    onSuccess: async () => {
      form.reset();
      await queryClient.invalidateQueries({ queryKey: ['extensions', session?.claims.tenant_id] });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenant Workspace"
        title="Extensions"
        description="This page is now backed by the live API. SIP passwords are accepted only on create and never returned in responses."
        actions={
          <Button onClick={() => extensionsQuery.refetch()} variant="secondary">
            <RefreshCcw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <DataCard
          title="Extension Inventory"
          description="Live tenant-scoped extension data fetched with the current JWT."
        >
          {extensionsQuery.isLoading ? (
            <p className="text-sm text-[var(--color-muted-fg)]">Loading extensions...</p>
          ) : extensionsQuery.isError ? (
            <ErrorState
              title="Could not load extensions"
              message={extensionsQuery.error instanceof Error ? extensionsQuery.error.message : 'Unknown error'}
            />
          ) : extensionsQuery.data && extensionsQuery.data.length > 0 ? (
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--color-surface-muted)] text-[var(--color-muted-fg)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Extension</th>
                    <th className="px-3 py-2 font-medium">Display Name</th>
                    <th className="px-3 py-2 font-medium">SIP Username</th>
                    <th className="px-3 py-2 font-medium">Default Destination</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
                  {extensionsQuery.data.map((extension) => (
                    <tr key={extension.id}>
                      <td className="px-3 py-2 font-mono text-xs">{extension.extension_number}</td>
                      <td className="px-3 py-2">{extension.display_name}</td>
                      <td className="px-3 py-2 font-mono text-xs text-[var(--color-muted-fg)]">
                        {extension.sip_username}
                      </td>
                      <td className="px-3 py-2 text-[var(--color-muted-fg)]">
                        {extension.default_destination_type
                          ? `${extension.default_destination_type}:${extension.default_destination_id ?? 'unset'}`
                          : 'Not configured'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={extension.status} />
                          <ShieldCheck className="size-4 text-[var(--color-success)]" aria-hidden="true" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No extensions yet"
              description="Create your first extension to prove tenant registration, encrypted SIP storage, and FreeSWITCH directory projection."
            />
          )}
        </DataCard>

        <DataCard
          title="Create Extension"
          description="This form posts plaintext SIP credentials once. The backend encrypts them before storing anything in PostgreSQL."
        >
          <form className="space-y-4" onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}>
            <Field label="Extension number">
              <input className={inputClassName} {...form.register('extension_number', { required: true })} />
            </Field>
            <Field label="Display name">
              <input className={inputClassName} {...form.register('display_name', { required: true })} />
            </Field>
            <Field label="SIP username (optional)">
              <input className={inputClassName} {...form.register('sip_username')} />
            </Field>
            <Field label="SIP password">
              <input
                className={inputClassName}
                type="password"
                {...form.register('sip_password', { required: true, minLength: 8 })}
              />
            </Field>

            {createMutation.isError ? (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
                {createMutation.error instanceof ApiError ? createMutation.error.message : 'Could not create extension'}
              </div>
            ) : null}

            <Button className="w-full" disabled={createMutation.isPending} type="submit">
              <Plus className="size-4" aria-hidden="true" />
              {createMutation.isPending ? 'Creating...' : 'Create Extension'}
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

const inputClassName =
  'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none transition focus:border-[var(--color-focus)] focus:ring-2 focus:ring-[var(--color-focus)]/20';
