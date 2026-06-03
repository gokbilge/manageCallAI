import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ConferenceService,
  ConferenceRoomNotFoundError,
} from './conference-room.service.js';
import type { ConferenceRoomRepository } from './conference-room.repository.js';
import type { ConferenceRoom, ConferenceRoomInternal } from './conference-room.types.js';

vi.mock('../../crypto/sip-secret.js', () => ({
  encryptSipPassword: vi.fn().mockReturnValue({ ciphertext: 'encrypted', keyId: 'key-1' }),
  decryptSipPassword: vi.fn().mockReturnValue('plaintext-pin'),
}));

const makeRoom = (overrides: Partial<ConferenceRoom> = {}): ConferenceRoom => ({
  id: 'room-1',
  tenant_id: 'tenant-1',
  name: 'Board Room',
  room_number: '8100',
  has_pin: false,
  max_participants: 20,
  record_calls: false,
  status: 'active',
  created_by: 'user-1',
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

const makeInternalRoom = (overrides: Partial<ConferenceRoomInternal> = {}): ConferenceRoomInternal => ({
  ...makeRoom(),
  pin_ciphertext: null,
  pin_key_id: null,
  ...overrides,
});

function makeRepo(overrides: Partial<ConferenceRoomRepository> = {}): ConferenceRoomRepository {
  return {
    findAllByTenant: vi.fn().mockResolvedValue([makeRoom()]),
    findById: vi.fn().mockResolvedValue(makeRoom()),
    findInternalByRoomNumber: vi.fn().mockResolvedValue(makeInternalRoom()),
    findAllActiveByTenant: vi.fn().mockResolvedValue([makeInternalRoom()]),
    create: vi.fn().mockResolvedValue(makeRoom()),
    update: vi.fn().mockResolvedValue(makeRoom()),
    setStatus: vi.fn().mockResolvedValue(makeRoom()),
    delete: vi.fn().mockResolvedValue(true),
    recordJoin: vi.fn().mockResolvedValue({ id: 'p-1', tenant_id: 'tenant-1', conference_room_id: 'room-1', call_id: 'call-1', joined_at: new Date(), left_at: null }),
    recordLeave: vi.fn().mockResolvedValue({ id: 'p-1', tenant_id: 'tenant-1', conference_room_id: 'room-1', call_id: 'call-1', joined_at: new Date(), left_at: new Date() }),
    findParticipants: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as ConferenceRoomRepository;
}

describe('ConferenceService', () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: ConferenceService;

  beforeEach(() => {
    repo = makeRepo();
    service = new ConferenceService(repo);
  });

  describe('list', () => {
    it('returns rooms for tenant', async () => {
      const rooms = await service.list('tenant-1');
      expect(rooms).toHaveLength(1);
      expect(vi.mocked(repo.findAllByTenant)).toHaveBeenCalledWith('tenant-1');
    });
  });

  describe('getById', () => {
    it('returns room when found', async () => {
      const room = await service.getById('room-1', 'tenant-1');
      expect(room.id).toBe('room-1');
    });

    it('throws ConferenceRoomNotFoundError when not found', async () => {
      repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
      service = new ConferenceService(repo);
      await expect(service.getById('missing', 'tenant-1')).rejects.toThrow(ConferenceRoomNotFoundError);
    });
  });

  describe('create', () => {
    it('creates room without PIN', async () => {
      const { encryptSipPassword } = await import('../../crypto/sip-secret.js');
      vi.mocked(encryptSipPassword).mockClear();
      await service.create({ tenant_id: 'tenant-1', name: 'Board Room', room_number: '8100' });
      expect(encryptSipPassword).not.toHaveBeenCalled();
      expect(vi.mocked(repo.create)).toHaveBeenCalledWith(
        expect.anything(),
        null,
        null,
      );
    });

    it('encrypts PIN when provided', async () => {
      const { encryptSipPassword } = await import('../../crypto/sip-secret.js');
      vi.mocked(encryptSipPassword).mockClear();
      await service.create({ tenant_id: 'tenant-1', name: 'Secure Room', room_number: '8200', pin: '1234' });
      expect(encryptSipPassword).toHaveBeenCalledWith('1234');
      expect(vi.mocked(repo.create)).toHaveBeenCalledWith(
        expect.anything(),
        'encrypted',
        'key-1',
      );
    });

    it('PIN is never returned in created room response', async () => {
      const room = await service.create({ tenant_id: 'tenant-1', name: 'Secure Room', room_number: '8200', pin: '1234' });
      expect((room as unknown as Record<string, unknown>).pin).toBeUndefined();
      expect((room as unknown as Record<string, unknown>).pin_ciphertext).toBeUndefined();
    });
  });

  describe('update', () => {
    it('updates room without changing PIN when pin not specified', async () => {
      const { encryptSipPassword } = await import('../../crypto/sip-secret.js');
      vi.mocked(encryptSipPassword).mockClear();
      await service.update('room-1', 'tenant-1', { name: 'New Name' });
      expect(encryptSipPassword).not.toHaveBeenCalled();
    });

    it('encrypts new PIN when provided', async () => {
      const { encryptSipPassword } = await import('../../crypto/sip-secret.js');
      vi.mocked(encryptSipPassword).mockClear();
      await service.update('room-1', 'tenant-1', { pin: '9999' });
      expect(encryptSipPassword).toHaveBeenCalledWith('9999');
    });

    it('clears PIN when pin is set to null', async () => {
      await service.update('room-1', 'tenant-1', { pin: null });
      expect(vi.mocked(repo.update)).toHaveBeenCalledWith(
        'room-1', 'tenant-1', expect.anything(), null, null,
      );
    });

    it('throws when room not found', async () => {
      repo = makeRepo({ update: vi.fn().mockResolvedValue(null) });
      service = new ConferenceService(repo);
      await expect(service.update('missing', 'tenant-1', { name: 'X' })).rejects.toThrow(ConferenceRoomNotFoundError);
    });
  });

  describe('decryptPin', () => {
    it('returns null when no PIN is set', () => {
      const room = makeInternalRoom({ pin_ciphertext: null, pin_key_id: null });
      expect(service.decryptPin(room)).toBeNull();
    });

    it('decrypts PIN when set', async () => {
      const room = makeInternalRoom({ pin_ciphertext: 'encrypted', pin_key_id: 'key-1' });
      const pin = service.decryptPin(room);
      expect(pin).toBe('plaintext-pin');
    });
  });

  describe('disable / enable', () => {
    it('disables a room', async () => {
      const room = await service.disable('room-1', 'tenant-1');
      expect(room).toBeDefined();
      expect(vi.mocked(repo.setStatus)).toHaveBeenCalledWith('room-1', 'tenant-1', 'disabled');
    });

    it('throws when room not found on disable', async () => {
      repo = makeRepo({ setStatus: vi.fn().mockResolvedValue(null) });
      service = new ConferenceService(repo);
      await expect(service.disable('missing', 'tenant-1')).rejects.toThrow(ConferenceRoomNotFoundError);
    });
  });

  describe('delete', () => {
    it('deletes a room', async () => {
      await expect(service.delete('room-1', 'tenant-1')).resolves.toBeUndefined();
    });

    it('throws when room not found', async () => {
      repo = makeRepo({ delete: vi.fn().mockResolvedValue(false) });
      service = new ConferenceService(repo);
      await expect(service.delete('missing', 'tenant-1')).rejects.toThrow(ConferenceRoomNotFoundError);
    });
  });

  describe('tenant isolation', () => {
    it('list uses tenant_id', async () => {
      await service.list('tenant-2');
      expect(vi.mocked(repo.findAllByTenant)).toHaveBeenCalledWith('tenant-2');
    });

    it('getById scopes by tenant', async () => {
      await service.getById('room-1', 'tenant-2');
      expect(vi.mocked(repo.findById)).toHaveBeenCalledWith('room-1', 'tenant-2');
    });
  });

  describe('recordJoin / recordLeave', () => {
    it('records a participant join', async () => {
      const p = await service.recordJoin('tenant-1', 'room-1', 'call-1');
      expect(p.call_id).toBe('call-1');
    });

    it('records a participant leave', async () => {
      const p = await service.recordLeave('tenant-1', 'room-1', 'call-1');
      expect(p?.left_at).toBeDefined();
    });
  });
});
