import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { ConferenceRoomsPage } from './conference-rooms-page';
import { apiRequest, ApiError } from '@/lib/api/client';

const mockUseAuth = vi.fn();

vi.mock('@/lib/auth/use-auth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/lib/api/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/client')>('@/lib/api/client');
  return { ...actual, apiRequest: vi.fn() };
});

const conferenceRoom = {
  id: 'room-1',
  tenant_id: 'tenant-1',
  name: 'Board Room',
  room_number: '8100',
  has_pin: true,
  max_participants: 12,
  record_calls: false,
  status: 'active' as const,
  created_by: 'user-1',
  created_at: '2026-06-04T10:00:00Z',
  updated_at: '2026-06-04T10:30:00Z',
};

const participant = {
  id: 'part-1',
  tenant_id: 'tenant-1',
  conference_room_id: 'room-1',
  call_id: 'call-123',
  joined_at: '2026-06-04T11:00:00Z',
  left_at: null,
};

function setRole(role: 'tenant_admin' | 'tenant_operator' | 'tenant_viewer') {
  mockUseAuth.mockReturnValue({
    session: {
      token: 'test-token',
      claims: {
        tenant_id: 'tenant-1',
        role,
      },
    },
  });
}

describe('ConferenceRoomsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setRole('tenant_admin');
  });

  it('renders loaded inventory and participant visibility', async () => {
    vi.mocked(apiRequest).mockImplementation(async (path) => {
      if (path === '/conference-rooms') {
        return { data: [conferenceRoom] };
      }
      if (path === '/conference-rooms/room-1/participants') {
        return { data: [participant] };
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    renderWithProviders(<ConferenceRoomsPage />);

    expect(screen.getByText('Conference Rooms')).toBeInTheDocument();
    await screen.findByText('Board Room');
    await screen.findByDisplayValue('8100');
    await screen.findByText('1 active participant');
    expect(screen.getByText('call-123')).toBeInTheDocument();
  });

  it('creates a new room and sends the room payload to the API', async () => {
    let rooms = [conferenceRoom];

    vi.mocked(apiRequest).mockImplementation(async (path, options) => {
      if (path === '/conference-rooms' && (!options?.method || options.method === 'GET')) {
        return { data: rooms };
      }
      if (path === '/conference-rooms' && options?.method === 'POST') {
        const payload = JSON.parse(String(options.body)) as Record<string, unknown>;
        const created = {
          ...conferenceRoom,
          id: 'room-2',
          room_number: payload.room_number as string,
          name: payload.name as string,
          max_participants: payload.max_participants as number,
          record_calls: payload.record_calls as boolean,
          has_pin: Boolean(payload.pin),
        };
        rooms = [created, ...rooms];
        return { data: created };
      }
      if (String(path).includes('/participants')) {
        return { data: [] };
      }
      throw new Error(`Unexpected request: ${options?.method ?? 'GET'} ${path}`);
    });

    renderWithProviders(<ConferenceRoomsPage />);

    await screen.findByText('Board Room');
    fireEvent.click(screen.getByRole('button', { name: /new room/i }));

    fireEvent.change(screen.getByLabelText('Room Number'), { target: { value: '8200' } });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'All Hands' } });
    fireEvent.change(screen.getByLabelText('PIN'), { target: { value: '4455' } });
    fireEvent.change(screen.getByLabelText('Max Participants'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Room' }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith('/conference-rooms', expect.objectContaining({
        method: 'POST',
        accessToken: 'test-token',
      }));
    });

    const [, requestOptions] = vi.mocked(apiRequest).mock.calls.find(
      ([path, options]) => path === '/conference-rooms' && options?.method === 'POST',
    )!;
    expect(JSON.parse(String(requestOptions!.body))).toMatchObject({
      room_number: '8200',
      name: 'All Hands',
      pin: '4455',
      max_participants: 30,
      record_calls: false,
    });
  });

  it('shows read-only guidance for tenant_viewer', async () => {
    setRole('tenant_viewer');
    vi.mocked(apiRequest).mockImplementation(async (path) => {
      if (path === '/conference-rooms') {
        return { data: [conferenceRoom] };
      }
      if (path === '/conference-rooms/room-1/participants') {
        return { data: [] };
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    renderWithProviders(<ConferenceRoomsPage />);

    await screen.findByText('Board Room');
    expect(screen.queryByRole('button', { name: /new room/i })).not.toBeInTheDocument();
    expect(screen.getByText(/read-only for conference rooms/i)).toBeInTheDocument();
  });

  it('lets tenant_operator update but not deactivate rooms', async () => {
    setRole('tenant_operator');
    vi.mocked(apiRequest).mockImplementation(async (path, options) => {
      if (path === '/conference-rooms' && (!options?.method || options.method === 'GET')) {
        return { data: [conferenceRoom] };
      }
      if (path === '/conference-rooms/room-1/participants') {
        return { data: [] };
      }
      if (path === '/conference-rooms/room-1' && options?.method === 'PATCH') {
        return { data: { ...conferenceRoom, name: 'Updated Room' } };
      }
      throw new Error(`Unexpected request: ${options?.method ?? 'GET'} ${path}`);
    });

    renderWithProviders(<ConferenceRoomsPage />);

    await screen.findByText('Board Room');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Updated Room' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith('/conference-rooms/room-1', expect.objectContaining({
        method: 'PATCH',
      }));
    });
    expect(screen.queryByRole('button', { name: 'Disable' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('disables, enables, and deletes rooms for tenant_admin', async () => {
    let room = conferenceRoom;

    vi.mocked(apiRequest).mockImplementation(async (path, options) => {
      if (path === '/conference-rooms' && (!options?.method || options.method === 'GET')) {
        return { data: room ? [room] : [] };
      }
      if (path === `/conference-rooms/${room.id}/participants`) {
        return { data: [] };
      }
      if (path === `/conference-rooms/${room.id}/disable` && options?.method === 'POST') {
        room = { ...room, status: 'disabled' as typeof room.status };
        return { data: room };
      }
      if (path === `/conference-rooms/${room.id}/enable` && options?.method === 'POST') {
        room = { ...room, status: 'active' };
        return { data: room };
      }
      if (path === `/conference-rooms/${room.id}` && options?.method === 'DELETE') {
        room = null as never;
        return {};
      }
      throw new Error(`Unexpected request: ${options?.method ?? 'GET'} ${path}`);
    });

    renderWithProviders(<ConferenceRoomsPage />);

    await screen.findByText('Board Room');

    fireEvent.click(screen.getByRole('button', { name: 'Disable' }));
    await screen.findByRole('button', { name: 'Enable' });

    fireEvent.click(screen.getByRole('button', { name: 'Enable' }));
    await screen.findByRole('button', { name: 'Disable' });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await screen.findByText('No conference rooms yet');
  });

  it('surfaces room-number conflicts clearly', async () => {
    vi.mocked(apiRequest).mockImplementation(async (path, options) => {
      if (path === '/conference-rooms' && (!options?.method || options.method === 'GET')) {
        return { data: [] };
      }
      if (path === '/conference-rooms' && options?.method === 'POST') {
        throw new ApiError('Room number 8100 is already in use for this tenant', 409);
      }
      throw new Error(`Unexpected request: ${options?.method ?? 'GET'} ${path}`);
    });

    renderWithProviders(<ConferenceRoomsPage />);

    await screen.findByText('No conference rooms yet');
    fireEvent.click(screen.getByRole('button', { name: /new room/i }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Duplicate' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Room' }));

    await waitFor(() => {
      expect(screen.getByText('Room lifecycle or validation check')).toBeInTheDocument();
    });
    expect(screen.getByText(/already in use for this tenant/i)).toBeInTheDocument();
  });
});
