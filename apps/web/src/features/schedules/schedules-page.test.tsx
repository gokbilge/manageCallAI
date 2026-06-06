import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
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

const mockSchedules = [
  {
    id: 'sched-1',
    name: 'Business Hours',
    description: null,
    status: 'active',
    timezone: 'America/New_York',
    weekly_rules_json: [{ day_of_week: 1, open_time: '09:00', close_time: '17:00' }],
    holiday_overrides_json: [],
    holiday_calendars: [{ id: 'cal-1', schedule_id: 'sched-1', name: 'Closures', status: 'active', entries_json: [{ date: '2026-12-25', closed: true }] }],
    temporary_overrides: [{ id: 'ovr-1', schedule_id: 'sched-1', name: 'Snow day', status: 'active', starts_at: '2026-01-05T13:00:00.000Z', ends_at: '2026-01-05T23:00:00.000Z', closed: true }],
    created_at: '2026-01-01T00:00:00Z',
  },
];

describe('SchedulesPage', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockResolvedValue({ data: mockSchedules });
  });

  it('renders the page heading', async () => {
    renderWithProviders(<SchedulesPage />);
    expect(screen.getByText('Enterprise Schedules')).toBeInTheDocument();
  });

  it('shows loaded schedules', async () => {
    renderWithProviders(<SchedulesPage />);
    await waitFor(() => {
      expect(screen.getAllByText('Business Hours')[0]).toBeInTheDocument();
    });
    expect(screen.getByText('America/New_York')).toBeInTheDocument();
    expect(screen.getAllByText('Holiday calendars')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Temporary overrides')[0]).toBeInTheDocument();
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
});
