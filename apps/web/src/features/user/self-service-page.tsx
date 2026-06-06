import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  BellOff,
  Circle,
  Download,
  ExternalLink,
  Headset,
  KeyRound,
  type LucideIcon,
  Phone,
  PhoneCall,
  PhoneForwarded,
  QrCode,
  RefreshCcw,
  Smartphone,
  Trash2,
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
import {
  generateProvisioningQr,
  getSipServer,
  SUPPORTED_SIP_CLIENTS,
} from '@/lib/provisioning/sip-provisioning';
import { buildCallHref, CALL_FALLBACK_MESSAGES } from '@/lib/calling/click-to-call';

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

type PresenceStatus = 'available' | 'away' | 'busy' | 'dnd' | 'offline';
type PresenceBody = { status: PresenceStatus };
type PresenceState = { user_id: string; tenant_id: string; status: PresenceStatus; updated_at: string };

const PRESENCE_OPTIONS: { value: PresenceStatus; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'away', label: 'Away' },
  { value: 'busy', label: 'Busy' },
  { value: 'dnd', label: 'Do Not Disturb' },
  { value: 'offline', label: 'Offline' },
];

const PRESENCE_COLOR: Record<PresenceStatus, string> = {
  available: 'text-[var(--color-success)]',
  away: 'text-[var(--color-warning)]',
  busy: 'text-[var(--color-danger)]',
  dnd: 'text-[var(--color-danger)]',
  offline: 'text-[var(--color-muted-fg)]',
};

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
  const [provisioningQr, setProvisioningQr] = useState<string | null>(null);
  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null);

  const extensionQuery = useMeQuery<ExtensionState>('extension', '/me/extension');
  const voicemailQuery = useMeQuery<VoicemailMessage[]>('voicemail', '/me/voicemail-messages');
  const callHistoryQuery = useMeQuery<CallEvent[]>('call-history', '/me/call-history');
  const devicesQuery = useMeQuery<DeviceRegistration[]>('devices', '/me/devices');
  const presenceQuery = useMeQuery<PresenceState>('presence', '/me/presence');

  const presenceMutation = useMutation({
    mutationFn: async (body: PresenceBody) => {
      await apiRequest('/me/presence', {
        method: 'PUT',
        body: JSON.stringify(body),
        accessToken: session?.token,
      });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['self-service', 'presence'] }),
  });

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
    onSuccess: async (result) => {
      setLastResetPassword(result.sip_password);
      setProvisioningQr(null);
      void queryClient.invalidateQueries({ queryKey: ['self-service', 'extension'] });
      const server = getSipServer();
      if (server) {
        try {
          const qr = await generateProvisioningQr({
            sip_username: result.sip_username,
            sip_password: result.sip_password,
            sip_server: server,
          });
          setProvisioningQr(qr);
        } catch { /* QR generation is best-effort */ }
      }
    },
  });

  const revokeDeviceMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      await apiRequest(`/me/devices/${deviceId}`, {
        method: 'DELETE',
        accessToken: session?.token,
      });
    },
    onSuccess: () => {
      setRevokeConfirmId(null);
      void queryClient.invalidateQueries({ queryKey: ['self-service', 'devices'] });
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
            void presenceQuery.refetch();
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

            <DataCard
              title="My Presence"
              description="Set your current status so others in the directory can see your availability."
            >
              {presenceQuery.isLoading ? (
                <InlineMuted>Loading presence…</InlineMuted>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {PRESENCE_OPTIONS.map((opt) => {
                      const current = presenceQuery.data?.status ?? 'available';
                      const isActive = current === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={presenceMutation.isPending}
                          onClick={() => presenceMutation.mutate({ status: opt.value })}
                          className={`flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-sm transition-colors disabled:opacity-50 ${
                            isActive
                              ? 'border-[var(--color-tenant)] bg-[var(--color-tenant)]/10 font-medium text-[var(--color-tenant)]'
                              : 'border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-muted-fg)] hover:bg-[var(--color-surface)] hover:text-[var(--color-fg)]'
                          }`}
                          aria-pressed={isActive}
                        >
                          <Circle className={`size-2.5 fill-current ${isActive ? PRESENCE_COLOR[opt.value] : 'text-[var(--color-border)]'}`} aria-hidden="true" />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  {presenceMutation.isError && (
                    <p className="text-sm text-[var(--color-error)]">Could not update presence. Please try again.</p>
                  )}
                </div>
              )}
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
                title="Devices &amp; Provisioning"
                description="SIP registrations for your extension. Revoke a device if it is lost or compromised."
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
                        aria-label={`Device: ${device.user_agent ?? 'SIP device'}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <Headset className="size-4 text-[var(--color-muted-fg)]" aria-hidden="true" />
                            <div>
                              <p className="text-sm font-medium">{device.user_agent ?? 'SIP device'}</p>
                              <p className="text-xs text-[var(--color-muted-fg)]">
                                {device.contact_domain ?? 'No contact domain'} · last seen {formatTimestamp(device.last_seen_at)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={device.status === 'registered' ? 'active' : 'inactive'} />
                            {revokeConfirmId === device.id ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-[var(--color-danger)]">Revoke?</span>
                                <Button
                                  variant="destructive"
                                  disabled={revokeDeviceMutation.isPending}
                                  onClick={() => revokeDeviceMutation.mutate(device.id)}
                                  aria-label="Confirm revoke device"
                                >
                                  {revokeDeviceMutation.isPending ? 'Revoking…' : 'Confirm'}
                                </Button>
                                <Button variant="secondary" onClick={() => setRevokeConfirmId(null)} aria-label="Cancel revoke">
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="secondary"
                                onClick={() => setRevokeConfirmId(device.id)}
                                aria-label={`Revoke ${device.user_agent ?? 'SIP device'}`}
                              >
                                <Trash2 className="size-4" aria-hidden="true" />
                                Revoke
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-[var(--color-muted-fg)]">
                      Revoking removes the SIP registration. The device must re-register with valid credentials.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <InlineMuted>No active or recent SIP registrations found. Set up a softphone below to get started.</InlineMuted>
                    <SoftphoneSetupGuide sipUsername={extension.sip_username} />
                  </div>
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
                <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)]">
                  <table className="min-w-[40rem] w-full text-left text-sm">
                    <thead className="bg-[var(--color-surface-muted)] text-[var(--color-muted-fg)]">
                      <tr>
                        <th className="px-3 py-2 font-medium">Direction</th>
                        <th className="px-3 py-2 font-medium">Counterpart</th>
                        <th className="px-3 py-2 font-medium">Outcome</th>
                        <th className="px-3 py-2 font-medium">Last event</th>
                        <th className="px-3 py-2 font-medium">Seen</th>
                        <th className="px-3 py-2 font-medium sr-only">Call back</th>
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
                          <td className="px-3 py-2">
                            {summary.counterpart ? (
                              <CallbackLink number={summary.counterpart} />
                            ) : null}
                          </td>
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
                  {voicemailQuery.data.map((message) => {
                    const vmCaller = callSummaries.find(s => s.call_id === message.call_id)?.counterpart ?? null;
                    return (
                    <div
                      key={message.id}
                      className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
                        <div className="flex flex-wrap shrink-0 items-center gap-2">
                          {vmCaller ? <CallbackLink number={vmCaller} /> : null}
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
                  );
                  })}
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
                  <div className="space-y-3">
                    <div className="rounded-[var(--radius-lg)] border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 px-4 py-3">
                      <p className="text-sm font-medium text-[var(--color-success)]">New SIP password</p>
                      <p className="mt-2 font-mono text-sm">{lastResetPassword}</p>
                      <p className="mt-2 text-xs text-[var(--color-muted-fg)]">Shown once — update your softphone now.</p>
                    </div>
                    {provisioningQr ? (
                      <ProvisioningQrCard
                        qrDataUrl={provisioningQr}
                        sipUsername={extension.sip_username}
                        sipServer={getSipServer()}
                      />
                    ) : getSipServer() ? null : (
                      <div className="rounded-[var(--radius-md)] border border-[var(--color-warning)]/20 bg-[var(--color-warning)]/10 px-3 py-2 text-xs text-[var(--color-warning)]">
                        <AlertTriangle className="mb-0.5 mr-1 inline size-3" aria-hidden="true" />
                        QR provisioning requires <code>VITE_SIP_DOMAIN</code> to be configured.
                      </div>
                    )}
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

function ProvisioningQrCard({
  qrDataUrl,
  sipUsername,
  sipServer,
}: {
  qrDataUrl: string;
  sipUsername: string;
  sipServer: string;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-4">
      <div className="flex items-center gap-2 mb-3">
        <QrCode className="size-4 text-[var(--color-muted-fg)]" aria-hidden="true" />
        <p className="text-sm font-medium">Scan to provision your softphone</p>
      </div>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <img
          src={qrDataUrl}
          alt="SIP provisioning QR code"
          className="size-[110px] rounded-[var(--radius-md)] border border-[var(--color-border)]"
        />
        <div className="space-y-1 text-xs text-[var(--color-muted-fg)]">
          <p className="font-medium text-[var(--color-fg)]">Connection details</p>
          <p>SIP server: <span className="font-mono text-[var(--color-fg)]">{sipServer}</span></p>
          <p>Username: <span className="font-mono text-[var(--color-fg)]">{sipUsername}</span></p>
          <p>Password: <span className="font-mono text-[var(--color-fg)]">shown above — do not share</span></p>
          <p className="pt-1">
            Zoiper and Linphone support direct QR scanning.
            Other clients require manual entry.
          </p>
        </div>
      </div>
      <p className="mt-3 text-[10px] text-[var(--color-muted-fg)]">
        This QR code encodes your new password. It will not appear again after you leave this page.
      </p>
    </div>
  );
}

function SoftphoneSetupGuide({ sipUsername }: { sipUsername: string }) {
  const sipServer = getSipServer();
  return (
    <div className="space-y-4">
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Smartphone className="size-4 text-[var(--color-muted-fg)]" aria-hidden="true" />
          <p className="text-sm font-medium">Set up a softphone</p>
        </div>
        <ol className="space-y-3 text-sm text-[var(--color-muted-fg)]">
          <li className="flex gap-3">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-muted)] text-[10px] font-bold text-[var(--color-fg)]">1</span>
            <span>Download a supported SIP client from the list below.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-muted)] text-[10px] font-bold text-[var(--color-fg)]">2</span>
            <span>
              Go to <strong className="text-[var(--color-fg)]">SIP Credential</strong> on this page and click
              <strong className="text-[var(--color-fg)]"> Reset SIP password</strong>.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-muted)] text-[10px] font-bold text-[var(--color-fg)]">3</span>
            <span>
              Scan the QR code that appears, or enter the connection details manually:
              {sipServer ? (
                <>
                  {' '}SIP server <code className="font-mono text-[var(--color-fg)]">{sipServer}</code>,
                  username <code className="font-mono text-[var(--color-fg)]">{sipUsername}</code>.
                </>
              ) : (
                ' contact your administrator for the SIP server address.'
              )}
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-muted)] text-[10px] font-bold text-[var(--color-fg)]">4</span>
            <span>Make a test call. Your device should appear in the Devices list above once registered.</span>
          </li>
        </ol>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium text-[var(--color-muted-fg)]">Supported SIP clients</p>
        <div className="space-y-2">
          {SUPPORTED_SIP_CLIENTS.map((client) => (
            <div
              key={client.name}
              className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-3"
            >
              <Headset className="mt-0.5 size-4 shrink-0 text-[var(--color-muted-fg)]" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{client.name}</p>
                <p className="text-xs text-[var(--color-muted-fg)]">{client.platforms}</p>
                <p className="mt-1 text-xs text-[var(--color-muted-fg)]">{client.notes}</p>
              </div>
              <a
                href={client.url}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-0.5 text-[var(--color-muted-fg)] hover:text-[var(--color-fg)]"
                aria-label={`Download ${client.name}`}
              >
                <ExternalLink className="size-4" aria-hidden="true" />
              </a>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--color-muted-fg)]">
          Any RFC 3261-compliant SIP client will work. The list above is tested and supported.
          Unsupported clients require manual configuration.
        </p>
      </div>
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

function CallbackLink({ number }: { number: string }) {
  const result = buildCallHref(number);
  if (!result.supported) {
    return (
      <span
        className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-muted-fg)] opacity-60"
        title={CALL_FALLBACK_MESSAGES[result.reason]}
        aria-disabled="true"
      >
        <PhoneCall className="size-3.5" aria-hidden="true" />
        Call back
      </span>
    );
  }
  return (
    <a
      href={result.href}
      className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs font-medium text-[var(--color-fg)] hover:bg-[var(--color-surface-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-tenant)]"
      aria-label={`Call back ${number}`}
    >
      <PhoneCall className="size-3.5" aria-hidden="true" />
      Call back
    </a>
  );
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
