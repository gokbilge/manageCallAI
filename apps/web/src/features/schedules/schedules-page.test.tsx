import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { SchedulesPage } from './schedules-page';
import { ApiError, apiRequest } from '@/lib/api/client';

vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: () => ({
    session: { token: 'test-token', claims: { tenant_id: 'tenant-1' } },
  }),
}));

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiRequest: vi.fn() };
});

const mockSchedules = [
  {
    id: 'sched-1',
    name: 'Business Hours',
    status: 'active',
    description: 'Weekday support line',
    timezone: 'America/New_York',
    weekly_rules_json: [{ day_of_week: 1, open_time: '09:00', close_time: '17:00' }],
    holiday_calendar_name: 'US Holidays',
    holiday_calendar_json: [],
    override_windows_json: [{ status: 'active' }],
    created_at: '2026-01-01T00:00:00Z',
  },
];

const inactiveSchedule = {
  id: 'sched-2',
  name: 'After Hours',
  status: 'inactive' as const,
  description: null,
  timezone: 'UTC',
  weekly_rules_json: [],
  holiday_calendar_name: null,
  holiday_calendar_json: [],
  override_windows_json: [],
  created_at: '2026-01-02T00:00:00Z',
};

describe('SchedulesPage', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockImplementation(async (path, options) => {
      if (path === '/schedules' && options?.method === 'POST') {
        return {
          data: {
            id: 'sched-3',
            name: 'Weekend',
            status: 'active',
            description: null,
            timezone: 'Europe/London',
            weekly_rules_json: [],
            holiday_calendar_name: null,
            holiday_calendar_json: [],
            override_windows_json: [],
            created_at: '2026-01-03T00:00:00Z',
          },
        };
      }

      if (path === '/schedules/sched-1/deactivate' && options?.method === 'POST') {
        return {
          data: {
            ...mockSchedules[0],
            status: 'inactive',
          },
        };
      }

      if (path === '/schedules') {
        return { data: mockSchedules };
      }

      throw new Error(`Unexpected API call: ${path}`);
    });
  });

  it('renders the page heading', async () => {
    renderWithProviders(<SchedulesPage />);
    expect(screen.getByText('Schedules')).toBeInTheDocument();
  });

  it('shows loaded schedules', async () => {
    renderWithProviders(<SchedulesPage />);
    await waitFor(() => {
      expect(screen.getByText('Business Hours')).toBeInTheDocument();
    });
    expect(screen.getByText('America/New_York')).toBeInTheDocument();
    expect(screen.getByText(/US Holidays/)).toBeInTheDocument();
    expect(screen.getByText('1 active')).toBeInTheDocument();
  });

  it('shows empty state when no schedules', async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: [] });
    renderWithProviders(<SchedulesPage />);
    await waitFor(() => {
      expect(screen.getByText('No schedules yet')).toBeInTheDocument();
    });
  });

  it('shows error state on fetch failure', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('Network error'));
    renderWithProviders(<SchedulesPage />);
    await waitFor(() => {
      expect(screen.getByText('Could not load schedules')).toBeInTheDocument();
    });
  });

  it('creates a schedule and resets the form', async () => {
    renderWithProviders(<SchedulesPage />);

    await waitFor(() => {
      expect(screen.getByText('Business Hours')).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText('Name');
    const timezoneInput = screen.getByLabelText('Timezone (IANA)');

    fireEvent.change(nameInput, { target: { value: 'Weekend' } });
    fireEvent.change(timezoneInput, { target: { value: 'Europe/London' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Schedule' }));

    await waitFor(() => {
      expect(vi.mocked(apiRequest)).toHaveBeenCalledWith(
        '/schedules',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Weekend', description: null, timezone: 'Europe/London', holiday_calendar_name: null }),
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toHaveValue('');
      expect(screen.getByLabelText('Timezone (IANA)')).toHaveValue('UTC');
    });
  });

  it('shows create errors from the API', async () => {
    vi.mocked(apiRequest).mockImplementation(async (path, options) => {
      if (path === '/schedules' && options?.method === 'POST') {
        throw new ApiError('Schedule name already exists', 409);
      }

      if (path === '/schedules') {
        return { data: mockSchedules };
      }

      throw new Error(`Unexpected API call: ${path}`);
    });

    renderWithProviders(<SchedulesPage />);
    await waitFor(() => {
      expect(screen.getByText('Business Hours')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Business Hours' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Schedule' }));

    await waitFor(() => {
      expect(screen.getByText('Schedule name already exists')).toBeInTheDocument();
    });
  });

  it('deactivates active schedules and hides the action for inactive ones', async () => {
    vi.mocked(apiRequest).mockImplementation(async (path, options) => {
      if (path === '/schedules/sched-1/deactivate' && options?.method === 'POST') {
        return { data: { ...mockSchedules[0], status: 'inactive' } };
      }

      if (path === '/schedules') {
        return { data: [...mockSchedules, inactiveSchedule] };
      }

      throw new Error(`Unexpected API call: ${path}`);
    });

    renderWithProviders(<SchedulesPage />);
    await waitFor(() => {
      expect(screen.getByText('After Hours')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Deactivate' })).toBeInTheDocument();
    const inactiveRow = screen.getByText('After Hours').closest('tr');
    expect(inactiveRow).not.toBeNull();
    expect(inactiveRow?.textContent).not.toContain('Deactivate');

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));

    await waitFor(() => {
      expect(vi.mocked(apiRequest)).toHaveBeenCalledWith(
        '/schedules/sched-1/deactivate',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});
