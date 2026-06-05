import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BellOff,
  Download,
  Headset,
  KeyRound,
  type LucideIcon,
  Phone,
  PhoneForwarded,
  RefreshCcw,
  User,
  Voicemail,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { ApiError, apiRequest } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';
import { buildCallSummaries, type CallEvent } from '@/lib/calls/call-events-api';

type ExtensionState = {
  id: string;
  extension_number: string;
  display_name: string;
  sip_username: string;
  dnd_enabled: boolean;
  call_forward_enabled: boolean;
  call_forward_target: string | null;
};

type DeviceRegistration = {
  id: string;
  status: 'registered' | 'expired' | 'unregistered';
  contact_domain: string | null;
  user_agent: string | null;
  registered_at: string | null;
  last_seen_at: string | null;
};

type VoicemailMessage = {
  id: string;
  call_id: string;
  duration_secs: number | null;
  size_bytes: number | null;
  read_at: string | null;
  recorded_at: string;
};

type ResetSipCredentialResponse = {
  extension_id: string;
  extension_number: string;
  sip_username: string;
  sip_password: string;
};

type DndBody = { enabled: boolean };
type ForwardBody = { enabled: boolean; target?: string | null };
type ForwardForm = { enabled: boolean; target: string };

function noRetryOnAuthOrPolicyError(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403 || error.status === 404)) return false;
  return failureCount < 1;
}

function apiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';
}

function useMeQuery<T>(key: string, path: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['self-service', key, session?.claims.tenant_id],
    queryFn: async () => {
      const result = await apiRequest<{ data: T }>(path, { accessToken: session?.token });
      return result.data;
    },
    enabled: Boolean(session?.token),
    retry: noRetryOnAuthOrPolicyError,
  });
}

export function SelfServicePage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [lastResetPassword, setLastResetPassword] = useState<string | null>(null);

  const extensionQuery = useMeQuery<ExtensionState>('extension', '/me/extension');
  const voicemailQuery = useMeQuery<VoicemailMessage[]>('voicemail', '/me/voicemail-messages');
  const callHistoryQuery = useMeQuery<CallEvent[]>('call-history', '/me/call-history');
  const devicesQuery = useMeQuery<DeviceRegistration[]>('devices', '/me/devices');

  const callSummaries = useMemo(
    () => buildCallSummaries(callHistoryQuery.data ?? []),
    [callHistoryQuery.data],
  );

  const extension = extensionQuery.data;
  const forwardForm = useForm<ForwardForm>({
    defaultValues: { enabled: false, target: '' },
  });

  useEffect(() => {
    if (extension) {
      forwardForm.reset({
        enabled: extension.call_forward_enabled,
        target: extension.call_forward_target ?? '',
      });
    }
  }, [extension, forwardForm]);

  const dndMutation = useMutation({
    mutationFn: async (body: DndBody) => {
      await apiRequest('/me/dnd', {
        method: 'PUT',
        body: JSON.stringify(body),
        accessToken: session?.token,
      });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['self-service', 'extension'] }),
  });

  const forwardMutation = useMutation({
    mutationFn: async (values: ForwardForm) => {
      const body: ForwardBody = {
        enabled: values.enabled,
        target: values.target.trim() || null,
      };
      await apiRequest('/me/call-forward', {
        method: 'PUT',
        body: JSON.stringify(body),
        accessToken: session?.token,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['self-service', 'extension'] });
      setLastResetPassword(null);
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (messageId: string) => {
      await apiRequest(`/me/voicemail-messages/${messageId}/read`, {
        method: 'POST',
        accessToken: session?.token,
      });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['self-service', 'voicemail'] }),
  });

  const deleteVoicemailMutation = useMutation({
    mutationFn: async (messageId: string) => {
      await apiRequest(`/me/voicemail-messages/${messageId}`, {
        method: 'DELETE',
        accessToken: session?.token,
      });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['self-service', 'voicemail'] }),
  });

  const resetSipMutation = useMutation({
    mutationFn: async () => {
      const result = await apiRequest<{ data: ResetSipCredentialResponse }>('/me/sip-credential/reset', {
        method: 'POST',
        accessToken: session?.token,
      });
      return result.data;
    },
    onSuccess: (result) => {
      setLastResetPassword(result.sip_password);
      void queryClient.invalidateQueries({ queryKey: ['self-service', 'extension'] });
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My Account"
        title="My Settings"
        description="Manage your own extension, voicemail, call history, device status, and one-time SIP credential rotation."
        actions={(
          <Button variant="secondary" onClick={() => {
            void extensionQuery.refetch();
            void voicemailQuery.refetch();
            void callHistoryQuery.refetch();
            void devicesQuery.refetch();
          }}
          >
            <RefreshCcw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        )}
      />

      {extensionQuery.isLoading ? (
        <p className="text-sm text-[var(--color-muted-fg)]">Loading your extension...</p>
      ) : extensionQuery.isError ? (
        <ErrorBanner error={extensionQuery.error} />
      ) : extension ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <DataCard title="My Extension" description="Your assigned extension and current self-service state.">
              <div className="grid gap-3 md:grid-cols-2">
                <FactCard icon={User} label="Display name" value={extension.display_name} />
                <FactCard icon={Phone} label="Extension" value={extension.extension_number} mono />
                <FactCard icon={KeyRound} label="SIP username" value={extension.sip_username} mono />
                <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3">
                  <p className="text-xs text-[var(--color-muted-fg)]">Do Not Disturb</p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{extension.dnd_enabled ? 'Enabled' : 'Disabled'}</p>
                    <StatusBadge status={extension.dnd_enabled ? 'inactive' : 'active'} />
                  </div>
                </div>
              </div>
            </DataCard>

            <div className="grid gap-6 lg:grid-cols-2">
              <DataCard
                title="Do Not Disturb"
                description="Reject incoming calls while keeping outbound calling available."
              >
                <div className="flex items-center justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <BellOff className={`size-5 ${extension.dnd_enabled ? 'text-[var(--color-error)]' : 'text-[var(--color-muted-fg)]'}`} aria-hidden="true" />
                    <div>
                      <p className="text-sm font-medium">{extension.dnd_enabled ? 'Incoming calls are blocked' : 'Incoming calls are allowed'}</p>
                      <p className="text-xs text-[var(--color-muted-fg)]">This changes only your own extension state.</p>
                    </div>
                  </div>
                  <Button
                    variant={extension.dnd_enabled ? 'destructive' : 'secondary'}
                    disabled={dndMutation.isPending}
                    onClick={() => dndMutation.mutate({ enabled: !extension.dnd_enabled })}
                  >
                    {dndMutation.isPending ? 'Saving...' : extension.dnd_enabled ? 'Disable DND' : 'Enable DND'}
                  </Button>
                </div>
              </DataCard>

              <DataCard
                title="Devices"
                description="Current SIP registration visibility for your owned extension."
              >
                {devicesQuery.isLoading ? (
                  <InlineMuted>Loading device status...</InlineMuted>
                ) : devicesQuery.isError ? (
                  <PolicyOrErrorState error={devicesQuery.error} disabledMessage="Your organization disabled device visibility." />
                ) : devicesQuery.data && devicesQuery.data.length > 0 ? (
                  <div className="space-y-3">
                    {devicesQuery.data.map((device) => (
                      <div
                        key={device.id}
                        className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <Headset className="size-4 text-[var(--color-muted-fg)]" aria-hidden="true" />
                            <div>
                              <p className="text-sm font-medium">{device.user_agent ?? 'SIP device'}</p>
                              <p className="text-xs text-[var(--color-muted-fg)]">
                                {device.contact_domain ?? 'No contact domain'} - last seen {formatTimestamp(device.last_seen_at)}
                              </p>
                            </div>
                          </div>
                          <StatusBadge status={device.status === 'registered' ? 'active' : 'inactive'} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <InlineMuted>No active or recent SIP registrations were found for your extension.</InlineMuted>
                )}
              </DataCard>
            </div>

            <DataCard
              title="Call Forwarding"
              description="Send incoming calls to another extension or an E.164 number when forwarding is enabled."
            >
              <form
                className="space-y-4"
                onSubmit={forwardForm.handleSubmit(async (values) => {
                  try {
                    await forwardMutation.mutateAsync(values);
                  } catch {
                    // surfaced via mutation state
                  }
                })}
              >
                <label className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm">
                  <input type="checkbox" {...forwardForm.register('enabled')} />
                  <div>
                    <p className="font-medium">Enable call forwarding</p>
                    <p className="text-xs text-[var(--color-muted-fg)]">Forward calls to a mobile number or another internal extension.</p>
                  </div>
                </label>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[var(--color-muted-fg)]">Forward to</label>
                  <div className="flex items-center gap-3">
                    <PhoneForwarded className="size-4 shrink-0 text-[var(--color-muted-fg)]" aria-hidden="true" />
                    <input
                      {...forwardForm.register('target')}
                      placeholder="+15551234567 or 200"
                      disabled={!forwardForm.watch('enabled')}
                      className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-tenant)] disabled:opacity-50"
                    />
                  </div>
                </div>

                {forwardMutation.isError ? (
                  <MutationMessage error={forwardMutation.error} fallback="Could not save call forwarding." />
                ) : forwardMutation.isSuccess ? (
                  <p className="text-sm text-[var(--color-success)]">Call forwarding saved.</p>
                ) : null}

                <Button type="submit" disabled={forwardMutation.isPending}>
                  {forwardMutation.isPending ? 'Saving...' : 'Save forwarding'}
                </Button>
              </form>
            </DataCard>

            <DataCard
              title="Call History"
              description="Recent calls touching your extension, derived from normalized call events."
            >
              {callHistoryQuery.isLoading ? (
                <InlineMuted>Loading your call history...</InlineMuted>
              ) : callHistoryQuery.isError ? (
                <PolicyOrErrorState error={callHistoryQuery.error} disabledMessage="Your organization disabled call-history access." />
              ) : callSummaries.length > 0 ? (
                <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[var(--color-surface-muted)] text-[var(--color-muted-fg)]">
                      <tr>
                        <th className="px-3 py-2 font-medium">Direction</th>
                        <th className="px-3 py-2 font-medium">Counterpart</th>
                        <th className="px-3 py-2 font-medium">Outcome</th>
                        <th className="px-3 py-2 font-medium">Last event</th>
                        <th className="px-3 py-2 font-medium">Seen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
                      {callSummaries.slice(0, 12).map((summary) => (
                        <tr key={summary.call_id}>
                          <td className="px-3 py-2 capitalize">{summary.direction}</td>
                          <td className="px-3 py-2 font-mono text-xs">{summary.counterpart ?? 'unknown'}</td>
                          <td className="px-3 py-2">
                            <StatusBadge status={summary.status === 'completed' ? 'active' : summary.status === 'failed' ? 'inactive' : 'pending'} />
                          </td>
                          <td className="px-3 py-2 text-xs text-[var(--color-muted-fg)]">{summary.failure_reason ?? summary.last_event_type}</td>
                          <td className="px-3 py-2 text-xs text-[var(--color-muted-fg)]">{formatTimestamp(summary.last_event_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <InlineMuted>No call-history events have been linked to your extension yet.</InlineMuted>
              )}
            </DataCard>
          </div>

          <div className="space-y-6">
            <DataCard
              title="Voicemail Inbox"
              description="Listen to or delete voicemail messages left on your mailbox."
            >
              {voicemailQuery.isLoading ? (
                <InlineMuted>Loading your voicemail messages...</InlineMuted>
              ) : voicemailQuery.isError ? (
                <PolicyOrErrorState error={voicemailQuery.error} disabledMessage="Your organization disabled voicemail self-service." />
              ) : voicemailQuery.data && voicemailQuery.data.length > 0 ? (
                <div className="space-y-3">
                  {voicemailQuery.data.map((message) => (
                    <div
                      key={message.id}
                      className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Voicemail className="size-4 text-[var(--color-muted-fg)]" aria-hidden="true" />
                            <p className="truncate text-sm font-medium">{message.call_id}</p>
                            <StatusBadge status={message.read_at ? 'active' : 'pending'} />
                          </div>
                          <p className="mt-1 text-xs text-[var(--color-muted-fg)]">
                            {message.duration_secs ?? 0}s - {formatBytes(message.size_bytes)} - {formatTimestamp(message.recorded_at)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <a
                            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium hover:bg-[var(--color-surface-muted)]"
                            href={`${apiBaseUrl()}/me/voicemail-messages/${message.id}/playback`}
                            rel="noreferrer"
                            target="_blank"
                          >
                            <Download className="size-4" aria-hidden="true" />
                            Open
                          </a>
                          {!message.read_at ? (
                            <Button
                              variant="secondary"
                              disabled={markReadMutation.isPending}
                              onClick={() => markReadMutation.mutate(message.id)}
                            >
                              Mark read
                            </Button>
                          ) : null}
                          <Button
                            variant="destructive"
                            disabled={deleteVoicemailMutation.isPending}
                            onClick={() => deleteVoicemailMutation.mutate(message.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <InlineMuted>No voicemail messages are available for your mailbox.</InlineMuted>
              )}
            </DataCard>

            <DataCard
              title="SIP Credential"
              description="Rotate your device password when a phone is reprovisioned or you suspect credential exposure."
            >
              <div className="space-y-4">
                <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3">
                  <p className="text-xs text-[var(--color-muted-fg)]">Current SIP username</p>
                  <p className="mt-1 font-mono text-sm font-medium">{extension.sip_username}</p>
                </div>
                <Button onClick={() => resetSipMutation.mutate()} disabled={resetSipMutation.isPending}>
                  <KeyRound className="size-4" aria-hidden="true" />
                  {resetSipMutation.isPending ? 'Resetting...' : 'Reset SIP password'}
                </Button>
                {resetSipMutation.isError ? (
                  <MutationMessage error={resetSipMutation.error} fallback="Could not reset your SIP credential." />
                ) : null}
                {lastResetPassword ? (
                  <div className="rounded-[var(--radius-lg)] border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 px-4 py-3">
                    <p className="text-sm font-medium text-[var(--color-success)]">New SIP password</p>
                    <p className="mt-2 font-mono text-sm">{lastResetPassword}</p>
                    <p className="mt-2 text-xs text-[var(--color-muted-fg)]">This value is shown once. Update your phone or softphone now.</p>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--color-muted-fg)]">Password resets are one-time responses. The API never re-shows the stored SIP secret.</p>
                )}
              </div>
            </DataCard>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FactCard({
  icon: Icon,
  label,
  value,
  mono = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3">
      <Icon className="size-5 text-[var(--color-muted-fg)]" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-xs text-[var(--color-muted-fg)]">{label}</p>
        <p className={`truncate text-sm font-medium ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
    </div>
  );
}

function MutationMessage({ error, fallback }: { error: unknown; fallback: string }) {
  if (error instanceof ApiError && error.status === 403) {
    return <p className="text-sm text-[var(--color-warning)]">This feature is disabled by your organization.</p>;
  }
  return (
    <p className="text-sm text-[var(--color-error)]">
      {error instanceof Error ? error.message : fallback}
    </p>
  );
}

function PolicyOrErrorState({ error, disabledMessage }: { error: unknown; disabledMessage: string }) {
  if (error instanceof ApiError && error.status === 403) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-warning)]/20 bg-[var(--color-warning)]/10 px-4 py-4 text-sm text-[var(--color-warning)]">
        {disabledMessage}
      </div>
    );
  }
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-error)]/20 bg-[var(--color-error)]/10 px-4 py-4 text-sm text-[var(--color-error)]">
      {error instanceof Error ? error.message : 'Could not load this section.'}
    </div>
  );
}

function ErrorBanner({ error }: { error: unknown }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-error)]/20 bg-[var(--color-error)]/10 px-4 py-4 text-sm text-[var(--color-error)]">
      {error instanceof ApiError && error.status === 404
        ? 'No extension is linked to your account. Contact your administrator.'
        : error instanceof Error
          ? error.message
          : 'Could not load your self-service profile.'}
    </div>
  );
}

function InlineMuted({ children }: { children: ReactNode }) {
  return <p className="text-sm text-[var(--color-muted-fg)]">{children}</p>;
}

function formatTimestamp(value: string | null): string {
  if (!value) return 'unknown';
  return new Date(value).toLocaleString();
}

function formatBytes(value: number | null): string {
  if (value === null) return 'size unknown';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
