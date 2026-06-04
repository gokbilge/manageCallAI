import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DoorOpen, Plus, RefreshCcw, ShieldAlert, Trash2, Users } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { apiRequest, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';
import { CAPABILITIES, hasCapability } from '@/lib/permissions/capabilities';

type ConferenceRoomStatus = 'active' | 'disabled';

type ConferenceRoom = {
  id: string;
  tenant_id: string;
  name: string;
  room_number: string;
  has_pin: boolean;
  max_participants: number;
  record_calls: boolean;
  status: ConferenceRoomStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type ConferenceParticipant = {
  id: string;
  tenant_id: string;
  conference_room_id: string;
  call_id: string;
  joined_at: string;
  left_at: string | null;
};

type ConferenceRoomForm = {
  room_number: string;
  name: string;
  pin: string;
  clear_pin: boolean;
  max_participants: number;
  record_calls: boolean;
};

const defaultFormValues: ConferenceRoomForm = {
  room_number: '8100',
  name: '',
  pin: '',
  clear_pin: false,
  max_participants: 20,
  record_calls: false,
};

export function ConferenceRoomsPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const role = session?.claims.role;
  const canCreate = hasCapability(role, CAPABILITIES.TENANT_CONFERENCE_ROOMS_CREATE);
  const canUpdate = hasCapability(role, CAPABILITIES.TENANT_CONFERENCE_ROOMS_UPDATE);
  const canDeactivate = hasCapability(role, CAPABILITIES.TENANT_CONFERENCE_ROOMS_DEACTIVATE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [surfaceError, setSurfaceError] = useState<string | null>(null);
  const form = useForm<ConferenceRoomForm>({ defaultValues: defaultFormValues });

  const roomsQuery = useQuery({
    queryKey: ['conference-rooms', session?.claims.tenant_id],
    enabled: Boolean(session?.token),
    queryFn: async () => {
      const result = await apiRequest<{ data: ConferenceRoom[] }>('/conference-rooms', {
        accessToken: session!.token,
      });
      return result.data;
    },
  });

  const selectedRoom = useMemo(
    () => roomsQuery.data?.find((room) => room.id === selectedId) ?? null,
    [roomsQuery.data, selectedId],
  );

  const participantsQuery = useQuery({
    queryKey: ['conference-room-participants', selectedId],
    enabled: Boolean(session?.token && selectedId && !isCreating),
    queryFn: async () => {
      const result = await apiRequest<{ data: ConferenceParticipant[] }>(`/conference-rooms/${selectedId}/participants`, {
        accessToken: session!.token,
      });
      return result.data;
    },
  });

  useEffect(() => {
    if (!roomsQuery.data || isCreating) {
      return;
    }

    if (selectedId) {
      const existing = roomsQuery.data.find((room) => room.id === selectedId);
      if (existing) {
        form.reset(mapRoomToForm(existing));
        return;
      }
    }

    if (roomsQuery.data.length > 0) {
      const first = roomsQuery.data[0]!;
      setSelectedId(first.id);
      form.reset(mapRoomToForm(first));
    }
  }, [form, isCreating, roomsQuery.data, selectedId]);

  const createMutation = useMutation({
    mutationFn: async (values: ConferenceRoomForm) => {
      const payload = toCreatePayload(values);
      return apiRequest<{ data: ConferenceRoom }>('/conference-rooms', {
        method: 'POST',
        accessToken: session!.token,
        body: JSON.stringify(payload),
      });
    },
    onSuccess: async ({ data }) => {
      setSurfaceError(null);
      setIsCreating(false);
      setSelectedId(data.id);
      await queryClient.invalidateQueries({ queryKey: ['conference-rooms', session?.claims.tenant_id] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: ConferenceRoomForm) => {
      if (!selectedRoom) {
        throw new Error('No conference room selected');
      }

      const payload = toUpdatePayload(values, selectedRoom);
      return apiRequest<{ data: ConferenceRoom }>(`/conference-rooms/${selectedRoom.id}`, {
        method: 'PATCH',
        accessToken: session!.token,
        body: JSON.stringify(payload),
      });
    },
    onSuccess: async () => {
      setSurfaceError(null);
      await queryClient.invalidateQueries({ queryKey: ['conference-rooms', session?.claims.tenant_id] });
    },
  });

  const disableMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRoom) {
        throw new Error('No conference room selected');
      }

      return apiRequest<{ data: ConferenceRoom }>(`/conference-rooms/${selectedRoom.id}/disable`, {
        method: 'POST',
        accessToken: session!.token,
      });
    },
    onSuccess: async () => {
      setSurfaceError(null);
      await queryClient.invalidateQueries({ queryKey: ['conference-rooms', session?.claims.tenant_id] });
    },
  });

  const enableMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRoom) {
        throw new Error('No conference room selected');
      }

      return apiRequest<{ data: ConferenceRoom }>(`/conference-rooms/${selectedRoom.id}/enable`, {
        method: 'POST',
        accessToken: session!.token,
      });
    },
    onSuccess: async () => {
      setSurfaceError(null);
      await queryClient.invalidateQueries({ queryKey: ['conference-rooms', session?.claims.tenant_id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRoom) {
        throw new Error('No conference room selected');
      }

      await apiRequest<unknown>(`/conference-rooms/${selectedRoom.id}`, {
        method: 'DELETE',
        accessToken: session!.token,
      });
    },
    onSuccess: async () => {
      setSurfaceError(null);
      setSelectedId(null);
      setIsCreating(false);
      form.reset(defaultFormValues);
      await queryClient.invalidateQueries({ queryKey: ['conference-rooms', session?.claims.tenant_id] });
    },
  });

  const hasInventory = (roomsQuery.data?.length ?? 0) > 0;
  const editorReadOnly = !isCreating && (!selectedRoom || !canUpdate);
  const canSubmitCreate = isCreating && canCreate;
  const canSubmitUpdate = !isCreating && Boolean(selectedRoom) && canUpdate;
  const activeParticipants = participantsQuery.data ?? [];

  async function submitForm(values: ConferenceRoomForm) {
    setSurfaceError(null);
    try {
      if (isCreating) {
        await createMutation.mutateAsync(values);
      } else if (canSubmitUpdate) {
        await updateMutation.mutateAsync(values);
      }
    } catch (error) {
      setSurfaceError(resolveMutationError(error, 'Could not save conference room'));
    }
  }

  async function handleDisable() {
    setSurfaceError(null);
    try {
      await disableMutation.mutateAsync();
    } catch (error) {
      setSurfaceError(resolveMutationError(error, 'Could not disable conference room'));
    }
  }

  async function handleEnable() {
    setSurfaceError(null);
    try {
      await enableMutation.mutateAsync();
    } catch (error) {
      setSurfaceError(resolveMutationError(error, 'Could not enable conference room'));
    }
  }

  async function handleDelete() {
    setSurfaceError(null);
    try {
      await deleteMutation.mutateAsync();
    } catch (error) {
      setSurfaceError(resolveMutationError(error, 'Could not delete conference room'));
    }
  }

  function startCreate() {
    setIsCreating(true);
    setSelectedId(null);
    setSurfaceError(null);
    form.reset(defaultFormValues);
  }

  function selectRoom(room: ConferenceRoom) {
    setIsCreating(false);
    setSelectedId(room.id);
    setSurfaceError(null);
    form.reset(mapRoomToForm(room));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenant Workspace"
        title="Conference Rooms"
        description="Manage tenant-scoped conference rooms backed by FreeSWITCH mod_conference, with room lifecycle, PIN posture, and live participant visibility surfaced directly in the operator UI."
        actions={
          <>
            {canCreate ? (
              <Button onClick={startCreate}>
                <Plus className="size-4" aria-hidden="true" />
                New Room
              </Button>
            ) : null}
            <Button onClick={() => roomsQuery.refetch()} variant="secondary">
              <RefreshCcw className="size-4" aria-hidden="true" />
              Refresh
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.35fr]">
        <DataCard
          title="Conference Room Inventory"
          description="Each room is tenant-scoped desired state. Runtime participant snapshots remain operational data derived from Go agent callbacks."
        >
          {roomsQuery.isLoading ? (
            <p className="text-sm text-[var(--color-muted-fg)]">Loading conference rooms...</p>
          ) : roomsQuery.isError ? (
            <ErrorState
              title="Could not load conference rooms"
              message={roomsQuery.error instanceof Error ? roomsQuery.error.message : 'Unknown error'}
            />
          ) : hasInventory ? (
            <div className="space-y-3">
              {roomsQuery.data!.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => selectRoom(room)}
                  className={`w-full rounded-[var(--radius-lg)] border px-4 py-3 text-left transition ${
                    selectedId === room.id && !isCreating
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                      : 'border-[var(--color-border)] bg-[var(--color-surface-muted)] hover:border-[var(--color-primary)]/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <DoorOpen className="size-4 text-[var(--color-muted-fg)]" aria-hidden="true" />
                        <span className="font-medium">{room.room_number}</span>
                        <span className="text-sm text-[var(--color-muted-fg)]">{room.name}</span>
                      </div>
                      <p className="mt-2 text-xs text-[var(--color-muted-fg)]">
                        Max {room.max_participants} participants
                        {room.has_pin ? ' · PIN protected' : ' · No PIN'}
                        {room.record_calls ? ' · Recording enabled' : ' · Recording disabled'}
                      </p>
                    </div>
                    <StatusBadge status={room.status === 'disabled' ? 'inactive' : room.status} />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No conference rooms yet"
              description="Create a tenant-scoped room to route callers into a managed conference bridge with optional PIN protection."
            />
          )}
        </DataCard>

        <div className="space-y-6">
          <DataCard
            title={isCreating ? 'Create Conference Room' : 'Conference Room Details'}
            description="Room number, PIN posture, participant limits, and record-call state are managed here. FreeSWITCH runtime execution stays behind the control plane boundary."
          >
            <div className="space-y-4">
              <SafetyCallout />

              {surfaceError ? (
                <WarningState title="Room lifecycle or validation check" message={surfaceError} />
              ) : null}

              {selectedRoom && !isCreating ? (
                <div className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 md:grid-cols-4">
                  <LifecycleItem label="Status" value={<StatusBadge status={selectedRoom.status === 'disabled' ? 'inactive' : selectedRoom.status} />} />
                  <LifecycleItem label="PIN" value={selectedRoom.has_pin ? 'Configured' : 'None'} />
                  <LifecycleItem label="Max members" value={selectedRoom.max_participants} />
                  <LifecycleItem label="Updated" value={formatDate(selectedRoom.updated_at)} />
                </div>
              ) : null}

              {!isCreating && !selectedRoom ? (
                <EmptyState title="Nothing selected" description="Select a conference room from the inventory or start a new room." />
              ) : (
                <form className="space-y-4" onSubmit={form.handleSubmit(submitForm)}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Room Number">
                      <input className={inputClass} disabled={!isCreating} {...form.register('room_number', { required: true })} />
                    </Field>
                    <Field label="Name">
                      <input className={inputClass} disabled={editorReadOnly} {...form.register('name', { required: true })} />
                    </Field>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="PIN">
                      <input
                        className={inputClass}
                        type="password"
                        placeholder={selectedRoom?.has_pin && !isCreating ? 'Leave blank to keep existing PIN' : 'Optional'}
                        disabled={editorReadOnly || form.watch('clear_pin')}
                        {...form.register('pin')}
                      />
                    </Field>
                    <Field label="Max Participants">
                      <input
                        className={inputClass}
                        type="number"
                        min={2}
                        max={200}
                        disabled={editorReadOnly}
                        {...form.register('max_participants', { valueAsNumber: true, required: true })}
                      />
                    </Field>
                  </div>

                  {selectedRoom?.has_pin && !isCreating ? (
                    <label className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm">
                      <input type="checkbox" disabled={editorReadOnly} {...form.register('clear_pin')} />
                      Clear PIN on save
                    </label>
                  ) : null}

                  <label className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm">
                    <input type="checkbox" disabled={editorReadOnly} {...form.register('record_calls')} />
                    Enable recording for conference calls
                  </label>

                  <div className="flex flex-wrap gap-2">
                    {canSubmitCreate || canSubmitUpdate ? (
                      <Button disabled={createMutation.isPending || updateMutation.isPending} type="submit">
                        {createMutation.isPending || updateMutation.isPending
                          ? 'Saving...'
                          : isCreating
                            ? 'Create Room'
                            : 'Save Changes'}
                      </Button>
                    ) : null}

                    {!isCreating && selectedRoom?.status === 'active' && canDeactivate ? (
                      <Button type="button" variant="secondary" disabled={disableMutation.isPending} onClick={handleDisable}>
                        {disableMutation.isPending ? 'Disabling...' : 'Disable'}
                      </Button>
                    ) : null}

                    {!isCreating && selectedRoom?.status === 'disabled' && canUpdate ? (
                      <Button type="button" variant="outline" disabled={enableMutation.isPending} onClick={handleEnable}>
                        {enableMutation.isPending ? 'Enabling...' : 'Enable'}
                      </Button>
                    ) : null}

                    {!isCreating && selectedRoom && canDeactivate ? (
                      <Button type="button" variant="destructive" disabled={deleteMutation.isPending} onClick={handleDelete}>
                        <Trash2 className="size-4" aria-hidden="true" />
                        {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                      </Button>
                    ) : null}
                  </div>

                  {!canCreate && !canUpdate && !canDeactivate ? (
                    <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface-muted)] px-4 py-3 text-sm text-[var(--color-muted-fg)]">
                      Your role is read-only for conference rooms. A tenant operator can create and edit rooms; a tenant admin can also disable or delete them.
                    </div>
                  ) : null}
                </form>
              )}
            </div>
          </DataCard>

          <DataCard
            title="Live Participants"
            description="Participant visibility comes from runtime callbacks. Empty state can mean the room is idle or runtime events have not been observed yet."
          >
            {!selectedRoom || isCreating ? (
              <EmptyState title="No room selected" description="Select a room to inspect current participants." />
            ) : participantsQuery.isLoading ? (
              <p className="text-sm text-[var(--color-muted-fg)]">Loading participants...</p>
            ) : participantsQuery.isError ? (
              <ErrorState
                title="Could not load participant state"
                message={participantsQuery.error instanceof Error ? participantsQuery.error.message : 'Unknown error'}
              />
            ) : activeParticipants.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Users className="size-4 text-[var(--color-info)]" aria-hidden="true" />
                  {activeParticipants.length} active participant{activeParticipants.length === 1 ? '' : 's'}
                </div>
                {activeParticipants.map((participant) => (
                  <div key={participant.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3">
                    <p className="text-sm font-medium">{participant.call_id}</p>
                    <p className="mt-1 text-xs text-[var(--color-muted-fg)]">Joined {formatDate(participant.joined_at)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No active participants" description="No joined calls are currently recorded for this room." />
            )}
          </DataCard>
        </div>
      </div>
    </div>
  );
}

function mapRoomToForm(room: ConferenceRoom): ConferenceRoomForm {
  return {
    room_number: room.room_number,
    name: room.name,
    pin: '',
    clear_pin: false,
    max_participants: room.max_participants,
    record_calls: room.record_calls,
  };
}

function toCreatePayload(values: ConferenceRoomForm) {
  return {
    room_number: values.room_number.trim(),
    name: values.name.trim(),
    pin: values.pin.trim() ? values.pin.trim() : null,
    max_participants: values.max_participants,
    record_calls: values.record_calls,
  };
}

function toUpdatePayload(values: ConferenceRoomForm, room: ConferenceRoom) {
  const payload: Record<string, unknown> = {
    name: values.name.trim(),
    max_participants: values.max_participants,
    record_calls: values.record_calls,
  };

  if (values.clear_pin) {
    payload.pin = null;
  } else if (values.pin.trim()) {
    payload.pin = values.pin.trim();
  } else if (!room.has_pin) {
    payload.pin = null;
  }

  return payload;
}

function resolveMutationError(error: unknown, fallback: string): string {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }
  return fallback;
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function LifecycleItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-muted-fg)]">{label}</p>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function SafetyCallout() {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-4 py-3 text-sm text-[var(--color-warning)]">
      <div className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-medium">Room numbers are live routing targets</p>
          <p className="mt-1">
            Create and update conference rooms through the control plane instead of editing FreeSWITCH dialplan directly. Runtime participant snapshots depend on Go agent callbacks.
          </p>
        </div>
      </div>
    </div>
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

function WarningState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-warning)]/25 bg-[var(--color-warning)]/10 px-4 py-4 text-sm text-[var(--color-warning)]">
      <p className="font-medium">{title}</p>
      <p className="mt-2">{message}</p>
    </div>
  );
}

const inputClass =
  'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none transition focus:border-[var(--color-focus)] focus:ring-2 focus:ring-[var(--color-focus)]/20 disabled:cursor-not-allowed disabled:bg-[var(--color-surface-muted)]';
