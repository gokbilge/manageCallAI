import { useMemo, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CalendarDays, OctagonAlert, Plus, RefreshCcw } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { PageHeader } from '@/components/layout/page-header';
import { DataCard } from '@/components/data/data-card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { apiRequest, ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/use-auth';

type HolidayOverride = {
  date: string;
  closed: boolean;
  open_time?: string;
  close_time?: string;
  label?: string;
};

type HolidayCalendar = {
  id: string;
  schedule_id: string;
  name: string;
  status: 'active' | 'inactive';
  entries_json: HolidayOverride[];
};

type ScheduleOverride = {
  id: string;
  schedule_id: string;
  name: string;
  status: 'active' | 'cancelled' | 'expired';
  starts_at: string;
  ends_at: string;
  closed: boolean;
};

type Schedule = {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'inactive';
  timezone: string;
  weekly_rules_json: unknown[];
  holiday_overrides_json: HolidayOverride[];
  holiday_calendars: HolidayCalendar[];
  temporary_overrides: ScheduleOverride[];
  created_at: string;
};

type CreateScheduleForm = {
  name: string;
  description: string;
  timezone: string;
};

type HolidayCalendarForm = {
  schedule_id: string;
  name: string;
  entry_date: string;
};

type OverrideForm = {
  schedule_id: string;
  name: string;
  starts_at: string;
  ends_at: string;
};

export function SchedulesPage() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const scheduleForm = useForm<CreateScheduleForm>({
    defaultValues: { name: '', description: '', timezone: 'UTC' },
  });
  const calendarForm = useForm<HolidayCalendarForm>({
    defaultValues: { schedule_id: '', name: '', entry_date: '' },
  });
  const overrideForm = useForm<OverrideForm>({
    defaultValues: { schedule_id: '', name: '', starts_at: '', ends_at: '' },
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

  const scheduleOptions = useMemo(
    () => (schedulesQuery.data ?? []).map((schedule) => ({ id: schedule.id, name: schedule.name })),
    [schedulesQuery.data],
  );

  const invalidateSchedules = async () => {
    await queryClient.invalidateQueries({ queryKey: ['schedules', session?.claims.tenant_id] });
  };

  const createScheduleMutation = useMutation({
    mutationFn: (values: CreateScheduleForm) =>
      apiRequest<{ data: Schedule }>('/schedules', {
        method: 'POST',
        accessToken: session!.token,
        body: JSON.stringify({
          name: values.name,
          description: values.description || undefined,
          timezone: values.timezone,
        }),
      }),
    onSuccess: async () => {
      scheduleForm.reset({ name: '', description: '', timezone: 'UTC' });
      await invalidateSchedules();
    },
  });

  const createHolidayCalendarMutation = useMutation({
    mutationFn: (values: HolidayCalendarForm) =>
      apiRequest<{ data: HolidayCalendar }>(`/schedules/${values.schedule_id}/holiday-calendars`, {
        method: 'POST',
        accessToken: session!.token,
        body: JSON.stringify({
          name: values.name,
          entries_json: [{ date: values.entry_date, closed: true }],
        }),
      }),
    onSuccess: async () => {
      calendarForm.reset({ schedule_id: '', name: '', entry_date: '' });
      await invalidateSchedules();
    },
  });

  const createOverrideMutation = useMutation({
    mutationFn: (values: OverrideForm) =>
      apiRequest<{ data: ScheduleOverride }>(`/schedules/${values.schedule_id}/overrides`, {
        method: 'POST',
        accessToken: session!.token,
        body: JSON.stringify({
          name: values.name,
          starts_at: values.starts_at,
          ends_at: values.ends_at,
          closed: true,
        }),
      }),
    onSuccess: async () => {
      overrideForm.reset({ schedule_id: '', name: '', starts_at: '', ends_at: '' });
      await invalidateSchedules();
    },
  });

  const cancelOverrideMutation = useMutation({
    mutationFn: ({ scheduleId, overrideId }: { scheduleId: string; overrideId: string }) =>
      apiRequest<{ data: ScheduleOverride }>(`/schedules/${scheduleId}/overrides/${overrideId}/cancel`, {
        method: 'POST',
        accessToken: session!.token,
      }),
    onSuccess: invalidateSchedules,
  });

  const scheduleCount = schedulesQuery.data?.length ?? 0;
  const totalCalendarCount = (schedulesQuery.data ?? []).reduce((sum, schedule) => sum + schedule.holiday_calendars.length, 0);
  const totalOverrideCount = (schedulesQuery.data ?? []).reduce((sum, schedule) => sum + schedule.temporary_overrides.length, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenant Workspace"
        title="Enterprise Schedules"
        description="Schedule-group records drive business-hours routing. Attach explicit holiday calendars and expiring temporary overrides without changing live routing logic by hand."
        actions={(
          <Button onClick={() => schedulesQuery.refetch()} variant="secondary">
            <RefreshCcw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
        )}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard title="Schedule groups" value={String(scheduleCount)} icon={<CalendarClock className="size-4" aria-hidden="true" />} />
        <SummaryCard title="Holiday calendars" value={String(totalCalendarCount)} icon={<CalendarDays className="size-4" aria-hidden="true" />} />
        <SummaryCard title="Temporary overrides" value={String(totalOverrideCount)} icon={<OctagonAlert className="size-4" aria-hidden="true" />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.85fr]">
        <DataCard title="Schedule Inventory" description="Schedule-group aggregates, including attached holiday calendars and temporary overrides.">
          {schedulesQuery.isLoading ? (
            <p className="text-sm text-[var(--color-muted-fg)]">Loading schedules...</p>
          ) : schedulesQuery.isError ? (
            <ErrorState
              title="Could not load schedules"
              message={schedulesQuery.error instanceof Error ? schedulesQuery.error.message : 'Unknown error'}
            />
          ) : schedulesQuery.data && schedulesQuery.data.length > 0 ? (
            <div className="space-y-4">
              {(schedulesQuery.data ?? []).map((schedule) => (
                <section key={schedule.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-semibold">
                        <CalendarClock className="size-4 text-[var(--color-muted-fg)]" aria-hidden="true" />
                        {schedule.name}
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-muted-fg)]">{schedule.timezone}</p>
                      {schedule.description ? (
                        <p className="mt-2 text-sm text-[var(--color-muted-fg)]">{schedule.description}</p>
                      ) : null}
                    </div>
                    <StatusBadge status={schedule.status} />
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <InlineMetric label="Weekly rules" value={`${schedule.weekly_rules_json.length}`} />
                    <InlineMetric label="Holiday calendars" value={`${schedule.holiday_calendars.length}`} />
                    <InlineMetric label="Temporary overrides" value={`${schedule.temporary_overrides.length}`} />
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-muted)] p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-muted-fg)]">Holiday calendars</p>
                      <ul className="mt-2 space-y-2 text-sm">
                        {schedule.holiday_calendars.length > 0 ? schedule.holiday_calendars.map((calendar) => (
                          <li key={calendar.id} className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">{calendar.name}</span>
                              <StatusBadge status={calendar.status} />
                            </div>
                            <p className="mt-1 text-xs text-[var(--color-muted-fg)]">{calendar.entries_json.length} holiday entry(s)</p>
                          </li>
                        )) : <li className="text-[var(--color-muted-fg)]">No holiday calendars yet.</li>}
                      </ul>
                    </div>

                    <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-muted)] p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-muted-fg)]">Temporary overrides</p>
                      <ul className="mt-2 space-y-2 text-sm">
                        {schedule.temporary_overrides.length > 0 ? schedule.temporary_overrides.map((override) => (
                          <li key={override.id} className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">{override.name}</span>
                              <StatusBadge status={override.status} />
                            </div>
                            <p className="mt-1 text-xs text-[var(--color-muted-fg)]">
                              {new Date(override.starts_at).toLocaleString()} to {new Date(override.ends_at).toLocaleString()}
                            </p>
                            {override.status === 'active' ? (
                              <Button
                                className="mt-2"
                                variant="secondary"
                                disabled={cancelOverrideMutation.isPending}
                                onClick={() => cancelOverrideMutation.mutate({ scheduleId: schedule.id, overrideId: override.id })}
                              >
                                Cancel override
                              </Button>
                            ) : null}
                          </li>
                        )) : <li className="text-[var(--color-muted-fg)]">No temporary overrides yet.</li>}
                      </ul>
                    </div>
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No schedules yet"
              description="Create a schedule group to enable business-hours routing, holiday closures, and temporary override workflows."
            />
          )}
        </DataCard>

        <div className="space-y-6">
          <DataCard title="Create Schedule Group" description="Create the business-hours aggregate that IVR and routing logic reference.">
            <form className="space-y-4" onSubmit={scheduleForm.handleSubmit((values) => createScheduleMutation.mutate(values))}>
              <Field label="Name">
                <input className={inputClass} {...scheduleForm.register('name', { required: true })} />
              </Field>
              <Field label="Description">
                <textarea className={inputClass} rows={3} {...scheduleForm.register('description')} />
              </Field>
              <Field label="Timezone (IANA)">
                <input className={inputClass} placeholder="America/New_York" {...scheduleForm.register('timezone', { required: true })} />
              </Field>
              <MutationError mutationError={createScheduleMutation.error} fallback="Could not create schedule group" />
              <Button className="w-full" disabled={createScheduleMutation.isPending} type="submit">
                <Plus className="size-4" aria-hidden="true" />
                {createScheduleMutation.isPending ? 'Creating...' : 'Create Schedule Group'}
              </Button>
            </form>
          </DataCard>

          <DataCard title="Add Holiday Calendar" description="Attach explicit holiday closures to a schedule group. This starter form creates one closure date per calendar.">
            <form className="space-y-4" onSubmit={calendarForm.handleSubmit((values) => createHolidayCalendarMutation.mutate(values))}>
              <Field label="Schedule group">
                <select className={inputClass} {...calendarForm.register('schedule_id', { required: true })}>
                  <option value="">Select schedule group</option>
                  {scheduleOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                </select>
              </Field>
              <Field label="Calendar name">
                <input className={inputClass} {...calendarForm.register('name', { required: true })} />
              </Field>
              <Field label="Closure date">
                <input className={inputClass} type="date" {...calendarForm.register('entry_date', { required: true })} />
              </Field>
              <MutationError mutationError={createHolidayCalendarMutation.error} fallback="Could not create holiday calendar" />
              <Button className="w-full" disabled={createHolidayCalendarMutation.isPending || scheduleOptions.length === 0} type="submit">
                <Plus className="size-4" aria-hidden="true" />
                {createHolidayCalendarMutation.isPending ? 'Saving...' : 'Add Holiday Calendar'}
              </Button>
            </form>
          </DataCard>

          <DataCard title="Add Temporary Override" description="Create an expiring closure override. Operators can cancel it later from the schedule inventory.">
            <form className="space-y-4" onSubmit={overrideForm.handleSubmit((values) => createOverrideMutation.mutate(values))}>
              <Field label="Schedule group">
                <select className={inputClass} {...overrideForm.register('schedule_id', { required: true })}>
                  <option value="">Select schedule group</option>
                  {scheduleOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                </select>
              </Field>
              <Field label="Override name">
                <input className={inputClass} {...overrideForm.register('name', { required: true })} />
              </Field>
              <Field label="Starts at (UTC)">
                <input className={inputClass} type="datetime-local" {...overrideForm.register('starts_at', { required: true })} />
              </Field>
              <Field label="Ends at (UTC)">
                <input className={inputClass} type="datetime-local" {...overrideForm.register('ends_at', { required: true })} />
              </Field>
              <MutationError mutationError={createOverrideMutation.error} fallback="Could not create temporary override" />
              <Button className="w-full" disabled={createOverrideMutation.isPending || scheduleOptions.length === 0} type="submit">
                <Plus className="size-4" aria-hidden="true" />
                {createOverrideMutation.isPending ? 'Saving...' : 'Add Temporary Override'}
              </Button>
            </form>
          </DataCard>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ title, value, icon }: { title: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-muted-fg)]">{title}</p>
          <p className="mt-2 text-2xl font-semibold">{value}</p>
        </div>
        <div className="rounded-full bg-[var(--color-surface-muted)] p-2 text-[var(--color-muted-fg)]">{icon}</div>
      </div>
    </div>
  );
}

function InlineMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-muted)] px-3 py-2">
      <p className="text-xs uppercase tracking-[0.12em] text-[var(--color-muted-fg)]">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
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

function MutationError({ mutationError, fallback }: { mutationError: unknown; fallback: string }) {
  if (!mutationError) {
    return null;
  }
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/10 px-4 py-3 text-sm text-[var(--color-danger)]">
      {mutationError instanceof ApiError ? mutationError.message : fallback}
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

const inputClass =
  'w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm outline-none transition focus:border-[var(--color-focus)] focus:ring-2 focus:ring-[var(--color-focus)]/20';
