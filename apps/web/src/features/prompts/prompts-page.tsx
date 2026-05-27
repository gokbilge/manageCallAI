import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mic, Plus, RefreshCcw } from 'lucide-react';
import { useForm } from 'react-hook-form';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { apiRequest, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';

type PromptAsset = {
  id: string;
  name: string;
  media_type: string;
  language: string | null;
  storage_uri: string | null;
  status: 'active' | 'inactive';
  created_at: string;
};

type CreatePromptForm = {
  name: string;
  media_type: string;
  language: string;
  storage_uri: string;
};

export function PromptsPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const form = useForm<CreatePromptForm>({
    defaultValues: { name: '', media_type: 'audio/wav', language: 'en', storage_uri: '' },
  });

  const promptsQuery = useQuery({
    queryKey: ['prompts', session?.claims.tenant_id],
    enabled: Boolean(session?.token),
    queryFn: async () => {
      const result = await apiRequest<{ data: PromptAsset[] }>('/prompts', {
        accessToken: session!.token,
      });
      return result.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: CreatePromptForm) =>
      apiRequest<{ data: PromptAsset }>('/prompts', {
        method: 'POST',
        accessToken: session!.token,
        body: JSON.stringify({
          name: values.name,
          media_type: values.media_type,
          language: values.language || undefined,
          storage_uri: values.storage_uri,
        }),
      }),
    onSuccess: async () => {
      form.reset();
      await queryClient.invalidateQueries({ queryKey: ['prompts', session?.claims.tenant_id] });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ data: PromptAsset }>(`/prompts/${id}/deactivate`, {
        method: 'POST',
        accessToken: session!.token,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['prompts', session?.claims.tenant_id] });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenant Workspace"
        title="Prompt Assets"
        description="Audio prompt files referenced by IVR flows. Register a storage URI to make a prompt available for flow authoring."
        actions={
          <Button onClick={() => promptsQuery.refetch()} variant="secondary">
            <RefreshCcw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <DataCard title="Prompt Inventory" description="All prompt assets for this tenant.">
          {promptsQuery.isLoading ? (
            <p className="text-sm text-[var(--color-muted-fg)]">Loading prompts...</p>
          ) : promptsQuery.isError ? (
            <ErrorState
              title="Could not load prompts"
              message={promptsQuery.error instanceof Error ? promptsQuery.error.message : 'Unknown error'}
            />
          ) : promptsQuery.data && promptsQuery.data.length > 0 ? (
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--color-surface-muted)] text-[var(--color-muted-fg)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Media type</th>
                    <th className="px-3 py-2 font-medium">Language</th>
                    <th className="px-3 py-2 font-medium">Storage URI</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
                  {promptsQuery.data.map((prompt) => (
                    <tr key={prompt.id}>
                      <td className="px-3 py-2 font-medium">
                        <span className="flex items-center gap-2">
                          <Mic className="size-3.5 text-[var(--color-muted-fg)]" aria-hidden="true" />
                          {prompt.name}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-[var(--color-muted-fg)]">{prompt.media_type}</td>
                      <td className="px-3 py-2 text-[var(--color-muted-fg)]">{prompt.language ?? '—'}</td>
                      <td className="max-w-[16rem] truncate px-3 py-2 font-mono text-xs text-[var(--color-muted-fg)]">
                        {prompt.storage_uri ?? '—'}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={prompt.status} />
                      </td>
                      <td className="px-3 py-2">
                        {prompt.status === 'active' && (
                          <Button
                            variant="secondary"
                            onClick={() => deactivateMutation.mutate(prompt.id)}
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
              title="No prompt assets yet"
              description="Register a prompt asset to make audio files referenceable in IVR flows."
            />
          )}
        </DataCard>

        <DataCard title="Register Prompt" description="Provide a storage URI pointing to an audio file accessible at runtime.">
          <form className="space-y-4" onSubmit={form.handleSubmit((v) => createMutation.mutate(v))}>
            <Field label="Name">
              <input className={inputClass} {...form.register('name', { required: true })} />
            </Field>
            <Field label="Media type">
              <input className={inputClass} {...form.register('media_type', { required: true })} />
            </Field>
            <Field label="Language (optional)">
              <input className={inputClass} {...form.register('language')} />
            </Field>
            <Field label="Storage URI">
              <input className={inputClass} {...form.register('storage_uri', { required: true })} />
            </Field>

            {createMutation.isError ? (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
                {createMutation.error instanceof ApiError ? createMutation.error.message : 'Could not register prompt'}
              </div>
            ) : null}

            <Button className="w-full" disabled={createMutation.isPending} type="submit">
              <Plus className="size-4" aria-hidden="true" />
              {createMutation.isPending ? 'Registering...' : 'Register Prompt'}
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
