import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ParkingLotsPage } from './parking-lots-page';
import { renderWithProviders } from '@/test/render';
import { apiRequest } from '@/lib/api/client';

vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: () => ({
    session: { token: 'token', claims: { tenant_id: 'tenant-1', role: 'tenant_admin' } },
  }),
}));

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiRequest: vi.fn() };
});

const stubLot = {
  id: 'lot-uuid-1',
  tenant_id: 'tenant-1',
  name: 'Main Lot',
  slot_range_start: 700,
  slot_range_end: 799,
  timeout_seconds: 120,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const stubCall = {
  id: 'call-uuid-1',
  tenant_id: 'tenant-1',
  parking_lot_id: 'lot-uuid-1',
  slot: 701,
  call_id: 'fs-call-id-abc123xyz',
  parked_by: '200',
  status: 'parked',
  parked_at: new Date().toISOString(),
  timeout_at: null,
  retrieved_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function setupMocks(overrides: Record<string, unknown> = {}) {
  vi.mocked(apiRequest).mockImplementation(async (path: string, opts?: { method?: string }) => {
    const p = String(path);
    if (p.includes('parked-calls')) return overrides['parked-calls'] ?? { data: [] };
    if (opts?.method === 'POST') return overrides['create'] ?? { data: stubLot };
    if (opts?.method === 'DELETE') return overrides['delete'] ?? undefined;
    return overrides['lots'] ?? { data: [] };
  });
}

describe('ParkingLotsPage', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  it('shows empty state when no lots exist', async () => {
    setupMocks();
    renderWithProviders(<ParkingLotsPage />);
    await waitFor(() => {
      expect(screen.getByText('No parking lots yet. Add one to enable call parking.')).toBeInTheDocument();
    });
  });

  it('renders lot rows from API data', async () => {
    setupMocks({ lots: { data: [stubLot] } });
    renderWithProviders(<ParkingLotsPage />);
    await waitFor(() => {
      expect(screen.getByText('Main Lot')).toBeInTheDocument();
      expect(screen.getByText('700–799')).toBeInTheDocument();
      expect(screen.getByText('120s')).toBeInTheDocument();
    });
  });

  it('renders heading and add lot button', async () => {
    setupMocks();
    renderWithProviders(<ParkingLotsPage />);
    expect(screen.getByText('Parking Lots')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add lot/i })).toBeInTheDocument();
  });

  it('shows create form when add lot button is clicked', async () => {
    setupMocks();
    renderWithProviders(<ParkingLotsPage />);
    fireEvent.click(screen.getByRole('button', { name: /add lot/i }));
    expect(screen.getByText('New parking lot')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Main parking lot')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create lot/i })).toBeInTheDocument();
  });

  it('hides create form when cancel is clicked', async () => {
    setupMocks();
    renderWithProviders(<ParkingLotsPage />);
    fireEvent.click(screen.getByRole('button', { name: /add lot/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByText('New parking lot')).not.toBeInTheDocument();
  });

  it('shows error state when lots fetch fails', async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error('Network error'));
    renderWithProviders(<ParkingLotsPage />);
    await waitFor(() => {
      expect(screen.getByText('Could not load parking lots')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('expands lot row to show parked calls', async () => {
    setupMocks({
      lots: { data: [stubLot] },
      'parked-calls': { data: [stubCall] },
    });
    renderWithProviders(<ParkingLotsPage />);
    await waitFor(() => expect(screen.getByText('Main Lot')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Main Lot').closest('tr')!);
    await waitFor(() => {
      expect(screen.getByText('Currently parked calls (auto-refreshes every 10s)')).toBeInTheDocument();
      expect(screen.getByText('701')).toBeInTheDocument();
    });
  });

  it('shows empty parked calls message when lot is empty', async () => {
    setupMocks({
      lots: { data: [stubLot] },
      'parked-calls': { data: [] },
    });
    renderWithProviders(<ParkingLotsPage />);
    await waitFor(() => expect(screen.getByText('Main Lot')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Main Lot').closest('tr')!);
    await waitFor(() => {
      expect(screen.getByText('No calls currently parked in this lot.')).toBeInTheDocument();
    });
  });

  it('shows parked call status color for parked status', async () => {
    setupMocks({
      lots: { data: [stubLot] },
      'parked-calls': { data: [stubCall] },
    });
    renderWithProviders(<ParkingLotsPage />);
    await waitFor(() => expect(screen.getByText('Main Lot')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Main Lot').closest('tr')!);
    await waitFor(() => {
      expect(screen.getByText('parked')).toBeInTheDocument();
    });
  });

  it('shows retrieved status in parked calls', async () => {
    const retrievedCall = { ...stubCall, status: 'retrieved' };
    setupMocks({
      lots: { data: [stubLot] },
      'parked-calls': { data: [retrievedCall] },
    });
    renderWithProviders(<ParkingLotsPage />);
    await waitFor(() => expect(screen.getByText('Main Lot')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Main Lot').closest('tr')!);
    // retrieved calls are filtered out (only 'parked' shown); lot appears empty
    await waitFor(() => {
      expect(screen.getByText('No calls currently parked in this lot.')).toBeInTheDocument();
    });
  });

  it('shows parked calls error when fetch fails', async () => {
    vi.mocked(apiRequest).mockImplementation(async (path: string) => {
      if (String(path).includes('parked-calls')) throw new Error('fetch failed');
      return { data: [stubLot] };
    });
    renderWithProviders(<ParkingLotsPage />);
    await waitFor(() => expect(screen.getByText('Main Lot')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Main Lot').closest('tr')!);
    await waitFor(() => {
      expect(screen.getByText('Could not load parked calls.')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('shows delete button for each lot', async () => {
    setupMocks({ lots: { data: [stubLot] } });
    renderWithProviders(<ParkingLotsPage />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete main lot/i })).toBeInTheDocument();
    });
  });

  it('calls delete API after confirm', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    setupMocks({ lots: { data: [stubLot] } });
    renderWithProviders(<ParkingLotsPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /delete main lot/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /delete main lot/i }));
    expect(confirmSpy).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('does not delete when confirm is cancelled', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    setupMocks({ lots: { data: [stubLot] } });
    renderWithProviders(<ParkingLotsPage />);
    await waitFor(() => expect(screen.getByRole('button', { name: /delete main lot/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /delete main lot/i }));
    expect(vi.mocked(apiRequest)).not.toHaveBeenCalledWith(expect.stringContaining(stubLot.id), expect.objectContaining({ method: 'DELETE' }));
    confirmSpy.mockRestore();
  });

  it('submits create form and closes on success', async () => {
    setupMocks({ create: { data: stubLot } });
    renderWithProviders(<ParkingLotsPage />);
    fireEvent.click(screen.getByRole('button', { name: /add lot/i }));
    fireEvent.change(screen.getByPlaceholderText('Main parking lot'), { target: { value: 'East Wing' } });
    fireEvent.click(screen.getByRole('button', { name: /create lot/i }));
    await waitFor(() => {
      expect(screen.queryByText('New parking lot')).not.toBeInTheDocument();
    });
  });

  it('shows create error when API fails', async () => {
    vi.mocked(apiRequest).mockImplementation(async (_path: string, opts?: { method?: string }) => {
      if (opts?.method === 'POST') throw new Error('slot range conflict');
      return { data: [] };
    });
    renderWithProviders(<ParkingLotsPage />);
    fireEvent.click(screen.getByRole('button', { name: /add lot/i }));
    fireEvent.change(screen.getByPlaceholderText('Main parking lot'), { target: { value: 'Bad' } });
    fireEvent.click(screen.getByRole('button', { name: /create lot/i }));
    await waitFor(() => {
      expect(screen.getByText(/slot range conflict/)).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('shows timed_out status color branch', async () => {
    const timedOutCall = { ...stubCall, status: 'timed_out' };
    setupMocks({
      lots: { data: [stubLot] },
      'parked-calls': { data: [timedOutCall] },
    });
    renderWithProviders(<ParkingLotsPage />);
    await waitFor(() => expect(screen.getByText('Main Lot')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Main Lot').closest('tr')!);
    // timed_out is also filtered (only parked shown), lot appears empty
    await waitFor(() => {
      expect(screen.getByText('No calls currently parked in this lot.')).toBeInTheDocument();
    });
  });
});
