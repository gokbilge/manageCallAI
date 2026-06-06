import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { SchedulesPage } from './schedules-page';
import { apiRequest } from '@/lib/api/client';

vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: () => ({
    session: { token: 'test-token', claims: { tenant_id: 'tenant-1' } },
  }),
}));

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiRequest: vi.fn() };
});

const scheduleList = [
  {
    id: 'sched-1',
    name: 'Business Hours',
    status: 'active',
    timezone: 'America/New_York',
    schedule_group_id: 'group-1',
    holiday_calendar_id: 'calendar-1',
    weekly_rules_json: [{ day_of_week: 1, open_time: '09:00', close_time: '17:00' }],
    holiday_overrides_json: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

const groupList = [
  {
    id: 'group-1',
    name: 'Weekday Core',
    description: null,
    status: 'active',
    weekly_rules_json: [{ day_of_week: 1, open_time: '09:00', close_time: '17:00' }],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

const calendarList = [
  {
    id: 'calendar-1',
    name: 'US Holidays',
    description: null,
    status: 'active',
    entries_json: [{ date: '2026-12-25', closed: true, name: 'Christmas Day' }],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

const overrideList = [
  {
    id: 'override-1',
    schedule_id: 'sched-1',
    name: 'Storm closure',
    reason: 'Weather',
    mode: 'closed',
    open_time: null,
    close_time: null,
    starts_at: '2026-06-10T10:00:00.000Z',
    ends_at: '2026-06-10T12:00:00.000Z',
    lifecycle_state: 'scheduled',
    cancelled_at: null,
    cancelled_by: null,
    created_by: 'user-1',
    created_at: '2026-06-09T09:00:00.000Z',
    updated_at: '2026-06-09T09:00:00.000Z',
  },
];

function mockQueries() {
  vi.mocked(apiRequest).mockImplementation(async (path: string, options?: RequestInit) => {
    if (path === '/schedules') {
      if (options?.method === 'POST') return { data: scheduleList[0] };
      return { data: scheduleList };
    }
    if (path === '/schedules/groups') {
      if (options?.method === 'POST') return { data: groupList[0] };
      return { data: groupList };
    }
    if (path === '/schedules/holiday-calendars') {
      if (options?.method === 'POST') return { data: calendarList[0] };
      return { data: calendarList };
    }
    if (path === '/schedules/sched-1/overrides') {
      if (options?.method === 'POST') return { data: overrideList[0] };
      return { data: overrideList };
    }
    if (path === '/schedules/sched-1/overrides/override-1/cancel') {
      return { data: { ...overrideList[0], lifecycle_state: 'cancelled' } };
    }
    throw new Error(`Unhandled path ${path}`);
  });
}

describe('SchedulesPage', () => {
  beforeEach(() => {
    mockQueries();
  });

  it('renders enterprise schedule inventory with linked assets', async () => {
    renderWithProviders(<SchedulesPage />);
    expect(screen.getByText('Enterprise Schedules')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText('Business Hours').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('Weekday Core').length).toBeGreaterThan(0);
    expect(screen.getAllByText('US Holidays').length).toBeGreaterThan(0);
  });

  it('shows override timeline and allows cancellation', async () => {
    renderWithProviders(<SchedulesPage />);
    await waitFor(() => {
      expect(screen.getByText('Storm closure')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith('/schedules/sched-1/overrides/override-1/cancel', expect.objectContaining({
        method: 'POST',
      }));
    });
  });

  it('surfaces invalid JSON in the group form before sending the request', async () => {
    renderWithProviders(<SchedulesPage />);
    await waitFor(() => {
      expect(screen.getByText('Schedule Groups')).toBeInTheDocument();
    });

    const groupNameInput = screen.getByLabelText('Group name');
    fireEvent.change(groupNameInput, { target: { value: 'Broken Group' } });

    const weeklyRulesTextareas = screen.getAllByRole('textbox');
    const weeklyRulesTextarea = weeklyRulesTextareas.find((node) => node.getAttribute('rows') === '8');
    expect(weeklyRulesTextarea).toBeDefined();
    fireEvent.change(weeklyRulesTextarea!, { target: { value: '{not json' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));
    await waitFor(() => {
      expect(screen.getByText('Weekly rules must be valid JSON')).toBeInTheDocument();
    });
  });
});
