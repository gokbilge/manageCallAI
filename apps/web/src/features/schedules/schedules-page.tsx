import { useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Clock3, Plus, RefreshCcw } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { apiRequest } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';
import {
  type HolidayCalendar,
  type Schedule,
  type ScheduleGroup,
  useHolidayCalendars,
  useScheduleGroups,
  useScheduleOverrides,
  useSchedules,
} from '@/lib/schedules/schedules-api';

const defaultWeeklyRules = JSON.stringify([
  { day_of_week: 1, open_time: '09:00', close_time: '17:00' },
  { day_of_week: 2, open_time: '09:00', close_time: '17:00' },
], null, 2);

const defaultHolidayEntries = JSON.stringify([
  { date: '2026-12-25', closed: true, name: 'Christmas Day' },
], null, 2);

type ScheduleFormState = {
  name: string;
  timezone: string;
  schedule_group_id: string;
  holiday_calendar_id: string;
};

type LibraryFormState = {
  name: string;
  description: string;
  jsonText: string;
};

type OverrideFormState = {
  name: string;
  reason: string;
  mode: 'closed' | 'custom_hours';
  open_time: string;
  close_time: string;
  starts_at: string;
  ends_at: string;
};

export function SchedulesPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const schedulesQuery = useSchedules();
  const groupsQuery = useScheduleGroups();
  const calendarsQuery = useHolidayCalendars();
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const overridesQuery = useScheduleOverrides(selectedScheduleId);

  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>({
    name: '',
    timezone: 'UTC',
    schedule_group_id: '',
    holiday_calendar_id: '',
  });
  const [groupForm, setGroupForm] = useState<LibraryFormState>({
    name: '',
    description: '',
    jsonText: defaultWeeklyRules,
  });
  const [calendarForm, setCalendarForm] = useState<LibraryFormState>({
    name: '',
    description: '',
    jsonText: defaultHolidayEntries,
  });
  const [overrideForm, setOverrideForm] = useState<OverrideFormState>({
    name: '',
    reason: '',
    mode: 'closed',
    open_time: '09:00',
    close_time: '17:00',
    starts_at: '',
    ends_at: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedScheduleId && schedulesQuery.data && schedulesQuery.data.length > 0) {
      setSelectedScheduleId(schedulesQuery.data[0]!.id);
    }
  }, [selectedScheduleId, schedulesQuery.data]);

  const invalidateSchedules = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['schedules', session?.claims.tenant_id] }),
      queryClient.invalidateQueries({ queryKey: ['schedule-groups', session?.claims.tenant_id] }),
      queryClient.invalidateQueries({ queryKey: ['holiday-calendars', session?.claims.tenant_id] }),
      queryClient.invalidateQueries({ queryKey: ['schedule-overrides', session?.claims.tenant_id] }),
    ]);
  };

  const createScheduleMutation = useMutation({
    mutationFn: async (values: ScheduleFormState) => {
      return apiRequest<{ data: Schedule }>('/schedules', {
        method: 'POST',
        accessToken: session!.token,
        body: JSON.stringify({
          name: values.name,
          timezone: values.timezone,
          schedule_group_id: values.schedule_group_id || null,
          holiday_calendar_id: values.holiday_calendar_id || null,
        }),
      });
    },
    onSuccess: async ({ data }) => {
      setScheduleForm({ name: '', timezone: 'UTC', schedule_group_id: '', holiday_calendar_id: '' });
      setSelectedScheduleId(data.id);
      setFormError(null);
      await invalidateSchedules();
    },
  });

  const createGroupMutation = useMutation({
    mutationFn: async (values: LibraryFormState) => {
      const weekly_rules_json = parseJson<ScheduleGroup['weekly_rules_json']>(values.jsonText, 'Weekly rules');
      return apiRequest<{ data: ScheduleGroup }>('/schedules/groups', {
        method: 'POST',
        accessToken: session!.token,
        body: JSON.stringify({
          name: values.name,
          description: values.description || null,
          weekly_rules_json,
        }),
      });
    },
    onSuccess: async () => {
      setGroupForm({ name: '', description: '', jsonText: defaultWeeklyRules });
      setFormError(null);
      await invalidateSchedules();
    },
  });

  const createCalendarMutation = useMutation({
    mutationFn: async (values: LibraryFormState) => {
      const entries_json = parseJson<HolidayCalendar['entries_json']>(values.jsonText, 'Holiday entries');
      return apiRequest<{ data: HolidayCalendar }>('/schedules/holiday-calendars', {
        method: 'POST',
        accessToken: session!.token,
        body: JSON.stringify({
          name: values.name,
          description: values.description || null,
          entries_json,
        }),
      });
    },
    onSuccess: async () => {
      setCalendarForm({ name: '', description: '', jsonText: defaultHolidayEntries });
      setFormError(null);
      await invalidateSchedules();
    },
  });

  const createOverrideMutation = useMutation({
    mutationFn: async (values: OverrideFormState) => {
      if (!selectedScheduleId) throw new Error('Select a schedule before creating an override');
      return apiRequest(`/schedules/${selectedScheduleId}/overrides`, {
        method: 'POST',
        accessToken: session!.token,
        body: JSON.stringify({
          name: values.name,
          reason: values.reason || null,
          mode: values.mode,
          open_time: values.mode === 'custom_hours' ? values.open_time : null,
          close_time: values.mode === 'custom_hours' ? values.close_time : null,
          starts_at: values.starts_at,
          ends_at: values.ends_at,
        }),
      });
    },
    onSuccess: async () => {
      setOverrideForm({
        name: '',
        reason: '',
        mode: 'closed',
        open_time: '09:00',
        close_time: '17:00',
        starts_at: '',
        ends_at: '',
      });
      setFormError(null);
      await invalidateSchedules();
    },
  });

  const cancelOverrideMutation = useMutation({
    mutationFn: async (overrideId: string) => {
      if (!selectedScheduleId) throw new Error('No schedule selected');
      return apiRequest(`/schedules/${selectedScheduleId}/overrides/${overrideId}/cancel`, {
        method: 'POST',
        accessToken: session!.token,
        body: JSON.stringify({}),
      });
    },
    onSuccess: async () => {
      await invalidateSchedules();
    },
  });

  const groupNameById = new Map((groupsQuery.data ?? []).map((group) => [group.id, group.name]));
  const calendarNameById = new Map((calendarsQuery.data ?? []).map((calendar) => [calendar.id, calendar.name]));

  const submitMutation = async (run: () => Promise<unknown>) => {
    try {
      setFormError(null);
      await run();
    } catch (error) {
      if (error instanceof Error) {
        setFormError(error.message);
      } else {
        setFormError('Request failed');
      }
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenant Workspace"
        title="Enterprise Schedules"
        description="Manage reusable business-hours groups, holiday calendars, and expiring temporary overrides without changing live routing logic by hand."
        actions={(
          <Button onClick={() => invalidateSchedules()} variant="secondary">
            <RefreshCcw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        )}
      />

      {formError ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
          {formError}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <DataCard title="Schedule Inventory" description="Schedules bind a timezone to a reusable rule group and holiday calendar.">
          <QueryState query={schedulesQuery} emptyTitle="No schedules yet" emptyDescription="Create a schedule to attach business-hours logic to IVR or route decisions.">
            {(schedules) => (
              <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[var(--color-surface-muted)] text-[var(--color-muted-fg)]">
                    <tr>
                      <th className="px-3 py-2 font-medium">Schedule</th>
                      <th className="px-3 py-2 font-medium">Timezone</th>
                      <th className="px-3 py-2 font-medium">Group</th>
                      <th className="px-3 py-2 font-medium">Calendar</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
                    {schedules.map((schedule) => (
                      <tr
                        key={schedule.id}
                        className={selectedScheduleId === schedule.id ? 'bg-[var(--color-surface-muted)]/60' : undefined}
                        onClick={() => setSelectedScheduleId(schedule.id)}
                      >
                        <td className="px-3 py-2 font-medium">
                          <span className="flex items-center gap-2">
                            <CalendarClock className="size-3.5 text-[var(--color-muted-fg)]" aria-hidden="true" />
                            {schedule.name}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-[var(--color-muted-fg)]">{schedule.timezone}</td>
                        <td className="px-3 py-2 text-[var(--color-muted-fg)]">{schedule.schedule_group_id ? groupNameById.get(schedule.schedule_group_id) ?? 'Linked group' : 'Inline rules'}</td>
                        <td className="px-3 py-2 text-[var(--color-muted-fg)]">{schedule.holiday_calendar_id ? calendarNameById.get(schedule.holiday_calendar_id) ?? 'Linked calendar' : 'Inline overrides'}</td>
                        <td className="px-3 py-2"><StatusBadge status={schedule.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </QueryState>
        </DataCard>

        <DataCard title="Create Schedule" description="Bind a tenant timezone to reusable schedule assets.">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submitMutation(() => createScheduleMutation.mutateAsync(scheduleForm));
            }}
          >
            <Field label="Name">
              <input className={inputClass} value={scheduleForm.name} onChange={(event) => setScheduleForm((current) => ({ ...current, name: event.target.value }))} />
            </Field>
            <Field label="Timezone (IANA)">
              <input className={inputClass} value={scheduleForm.timezone} onChange={(event) => setScheduleForm((current) => ({ ...current, timezone: event.target.value }))} />
            </Field>
            <Field label="Schedule Group">
              <select className={inputClass} value={scheduleForm.schedule_group_id} onChange={(event) => setScheduleForm((current) => ({ ...current, schedule_group_id: event.target.value }))}>
                <option value="">Inline rules only</option>
                {(groupsQuery.data ?? []).map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Holiday Calendar">
              <select className={inputClass} value={scheduleForm.holiday_calendar_id} onChange={(event) => setScheduleForm((current) => ({ ...current, holiday_calendar_id: event.target.value }))}>
                <option value="">Inline overrides only</option>
                {(calendarsQuery.data ?? []).map((calendar) => (
                  <option key={calendar.id} value={calendar.id}>{calendar.name}</option>
                ))}
              </select>
            </Field>
            <Button className="w-full" disabled={createScheduleMutation.isPending} type="submit">
              <Plus className="size-4" aria-hidden="true" />
              {createScheduleMutation.isPending ? 'Creating...' : 'Create Schedule'}
            </Button>
          </form>
        </DataCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <DataCard title="Schedule Groups" description="Reusable weekly business-hour rule sets.">
          <div className="space-y-4">
            <QueryState query={groupsQuery} emptyTitle="No schedule groups" emptyDescription="Create reusable weekly rule sets for enterprise schedules.">
              {(groups) => (
                <div className="space-y-3">
                  {groups.map((group) => (
                    <div key={group.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{group.name}</p>
                          <p className="text-sm text-[var(--color-muted-fg)]">{group.weekly_rules_json.length} weekly rule(s)</p>
                        </div>
                        <StatusBadge status={group.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </QueryState>

            <form
              className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)]/60 p-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submitMutation(() => createGroupMutation.mutateAsync(groupForm));
              }}
            >
              <Field label="Group name">
                <input className={inputClass} value={groupForm.name} onChange={(event) => setGroupForm((current) => ({ ...current, name: event.target.value }))} />
              </Field>
              <Field label="Description">
                <input className={inputClass} value={groupForm.description} onChange={(event) => setGroupForm((current) => ({ ...current, description: event.target.value }))} />
              </Field>
              <Field label="Weekly rules JSON">
                <textarea className={textareaClass} rows={8} value={groupForm.jsonText} onChange={(event) => setGroupForm((current) => ({ ...current, jsonText: event.target.value }))} />
              </Field>
              <Button disabled={createGroupMutation.isPending} type="submit">
                <Plus className="size-4" aria-hidden="true" />
                {createGroupMutation.isPending ? 'Saving...' : 'Create Group'}
              </Button>
            </form>
          </div>
        </DataCard>

        <DataCard title="Holiday Calendars" description="Reusable closures and special-day windows.">
          <div className="space-y-4">
            <QueryState query={calendarsQuery} emptyTitle="No holiday calendars" emptyDescription="Create shared holiday calendars for closures and reduced hours.">
              {(calendars) => (
                <div className="space-y-3">
                  {calendars.map((calendar) => (
                    <div key={calendar.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{calendar.name}</p>
                          <p className="text-sm text-[var(--color-muted-fg)]">{calendar.entries_json.length} calendar entr{calendar.entries_json.length === 1 ? 'y' : 'ies'}</p>
                        </div>
                        <StatusBadge status={calendar.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </QueryState>

            <form
              className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-muted)]/60 p-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submitMutation(() => createCalendarMutation.mutateAsync(calendarForm));
              }}
            >
              <Field label="Calendar name">
                <input className={inputClass} value={calendarForm.name} onChange={(event) => setCalendarForm((current) => ({ ...current, name: event.target.value }))} />
              </Field>
              <Field label="Description">
                <input className={inputClass} value={calendarForm.description} onChange={(event) => setCalendarForm((current) => ({ ...current, description: event.target.value }))} />
              </Field>
              <Field label="Holiday entries JSON">
                <textarea className={textareaClass} rows={8} value={calendarForm.jsonText} onChange={(event) => setCalendarForm((current) => ({ ...current, jsonText: event.target.value }))} />
              </Field>
              <Button disabled={createCalendarMutation.isPending} type="submit">
                <Plus className="size-4" aria-hidden="true" />
                {createCalendarMutation.isPending ? 'Saving...' : 'Create Calendar'}
              </Button>
            </form>
          </div>
        </DataCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <DataCard title="Temporary Overrides" description="Create explicit, expiring schedule overrides for closures or special operating windows.">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submitMutation(() => createOverrideMutation.mutateAsync(overrideForm));
            }}
          >
            <Field label="Target schedule">
              <select className={inputClass} value={selectedScheduleId ?? ''} onChange={(event) => setSelectedScheduleId(event.target.value || null)}>
                <option value="">Select schedule</option>
                {(schedulesQuery.data ?? []).map((schedule) => (
                  <option key={schedule.id} value={schedule.id}>{schedule.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Override name">
              <input className={inputClass} value={overrideForm.name} onChange={(event) => setOverrideForm((current) => ({ ...current, name: event.target.value }))} />
            </Field>
            <Field label="Reason">
              <input className={inputClass} value={overrideForm.reason} onChange={(event) => setOverrideForm((current) => ({ ...current, reason: event.target.value }))} />
            </Field>
            <Field label="Mode">
              <select className={inputClass} value={overrideForm.mode} onChange={(event) => setOverrideForm((current) => ({ ...current, mode: event.target.value as OverrideFormState['mode'] }))}>
                <option value="closed">Closed</option>
                <option value="custom_hours">Custom hours</option>
              </select>
            </Field>
            {overrideForm.mode === 'custom_hours' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Open time">
                  <input className={inputClass} value={overrideForm.open_time} onChange={(event) => setOverrideForm((current) => ({ ...current, open_time: event.target.value }))} />
                </Field>
                <Field label="Close time">
                  <input className={inputClass} value={overrideForm.close_time} onChange={(event) => setOverrideForm((current) => ({ ...current, close_time: event.target.value }))} />
                </Field>
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Starts at">
                <input className={inputClass} type="datetime-local" value={overrideForm.starts_at} onChange={(event) => setOverrideForm((current) => ({ ...current, starts_at: event.target.value }))} />
              </Field>
              <Field label="Ends at">
                <input className={inputClass} type="datetime-local" value={overrideForm.ends_at} onChange={(event) => setOverrideForm((current) => ({ ...current, ends_at: event.target.value }))} />
              </Field>
            </div>
            <Button className="w-full" disabled={createOverrideMutation.isPending || !selectedScheduleId} type="submit">
              <Clock3 className="size-4" aria-hidden="true" />
              {createOverrideMutation.isPending ? 'Creating...' : 'Create Override'}
            </Button>
          </form>
        </DataCard>

        <DataCard title="Override Timeline" description="Scheduled, active, expired, and cancelled overrides for the selected schedule.">
          <QueryState query={overridesQuery} emptyTitle="No overrides yet" emptyDescription="The selected schedule has no temporary overrides.">
            {(overrides) => (
              <div className="space-y-3">
                {overrides.map((override) => (
                  <div key={override.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{override.name}</p>
                        <p className="text-sm text-[var(--color-muted-fg)]">
                          {override.mode === 'closed' ? 'Closed' : `${override.open_time} - ${override.close_time}`} • {new Date(override.starts_at).toLocaleString()} to {new Date(override.ends_at).toLocaleString()}
                        </p>
                        {override.reason ? <p className="mt-1 text-xs text-[var(--color-muted-fg)]">{override.reason}</p> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={override.lifecycle_state} />
                        {(override.lifecycle_state === 'scheduled' || override.lifecycle_state === 'active') ? (
                          <Button
                            variant="secondary"
                            disabled={cancelOverrideMutation.isPending}
                            onClick={() => cancelOverrideMutation.mutate(override.id)}
                          >
                            Cancel
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </QueryState>
        </DataCard>
      </div>
    </div>
  );
}

function parseJson<T>(value: string, label: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(`${label} must be valid JSON`);
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

function QueryState<T>({
  query,
  emptyTitle,
  emptyDescription,
  children,
}: {
  query: {
    isLoading: boolean;
    isError: boolean;
    error: Error | null;
    data: T[] | undefined;
  };
  emptyTitle: string;
  emptyDescription: string;
  children: (data: T[]) => ReactNode;
}) {
  if (query.isLoading) {
    return <p className="text-sm text-[var(--color-muted-fg)]">Loading...</p>;
  }
  if (query.isError) {
    return <ErrorState title="Could not load data" message={query.error?.message ?? 'Unknown error'} />;
  }
  if (!query.data || query.data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }
  return <>{children(query.data)}</>;
}

const inputClass =
  'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none transition focus:border-[var(--color-focus)] focus:ring-2 focus:ring-[var(--color-focus)]/20';

const textareaClass = `${inputClass} min-h-[10rem] font-mono text-xs`;
