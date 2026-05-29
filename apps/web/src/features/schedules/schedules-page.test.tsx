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
    status: 'active',
    timezone: 'America/New_York',
    weekly_rules_json: [{ day_of_week: 1, open_time: '09:00', close_time: '17:00' }],
    holiday_overrides_json: [],
    created_at: '2026-01-01T00:00:00Z',
  },
];

describe('SchedulesPage', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockResolvedValue({ data: mockSchedules });
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
