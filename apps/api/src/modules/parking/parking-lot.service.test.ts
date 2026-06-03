import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ParkingService,
  ParkingLotNotFoundError,
  ParkingSlotConflictError,
  ParkingSlotNotFoundError,
} from './parking-lot.service.js';
import type { ParkingLotRepository } from './parking-lot.repository.js';
import type { ParkedCall, ParkingLot } from './parking-lot.types.js';

const makeLot = (overrides: Partial<ParkingLot> = {}): ParkingLot => ({
  id: 'lot-1',
  tenant_id: 'tenant-1',
  name: 'Main Lot',
  slot_range_start: 801,
  slot_range_end: 820,
  timeout_seconds: 300,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

const makeCall = (overrides: Partial<ParkedCall> = {}): ParkedCall => ({
  id: 'call-1',
  tenant_id: 'tenant-1',
  parking_lot_id: 'lot-1',
  slot: 801,
  call_id: 'uuid-call',
  parked_by: '101',
  status: 'parked',
  parked_at: new Date(),
  timeout_at: new Date(Date.now() + 300_000),
  retrieved_at: null,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

function makeRepo(overrides: Partial<ParkingLotRepository> = {}): ParkingLotRepository {
  return {
    findAllByTenant: vi.fn().mockResolvedValue([makeLot()]),
    findById: vi.fn().mockResolvedValue(makeLot()),
    findByTenantAndSlot: vi.fn().mockResolvedValue(makeLot()),
    create: vi.fn().mockResolvedValue(makeLot()),
    update: vi.fn().mockResolvedValue(makeLot()),
    delete: vi.fn().mockResolvedValue(true),
    findParkedCallsByLot: vi.fn().mockResolvedValue([makeCall()]),
    findActiveParkedCallBySlot: vi.fn().mockResolvedValue(null),
    parkCall: vi.fn().mockResolvedValue(makeCall()),
    retrieveCall: vi.fn().mockResolvedValue(makeCall({ status: 'retrieved', retrieved_at: new Date() })),
    timeoutCall: vi.fn().mockResolvedValue(makeCall({ status: 'timed_out' })),
    ...overrides,
  } as unknown as ParkingLotRepository;
}

describe('ParkingService', () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: ParkingService;

  beforeEach(() => {
    repo = makeRepo();
    service = new ParkingService(repo);
  });

  describe('getLotById', () => {
    it('returns lot when found', async () => {
      const lot = await service.getLotById('lot-1', 'tenant-1');
      expect(lot.id).toBe('lot-1');
    });

    it('throws ParkingLotNotFoundError when not found', async () => {
      repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
      service = new ParkingService(repo);
      await expect(service.getLotById('missing', 'tenant-1')).rejects.toThrow(ParkingLotNotFoundError);
    });
  });

  describe('createLot', () => {
    it('creates a parking lot', async () => {
      const lot = await service.createLot({ tenant_id: 'tenant-1', name: 'Main Lot' });
      expect(lot.name).toBe('Main Lot');
      expect(vi.mocked(repo.create)).toHaveBeenCalled();
    });
  });

  describe('updateLot', () => {
    it('updates a parking lot', async () => {
      const lot = await service.updateLot('lot-1', 'tenant-1', { timeout_seconds: 600 });
      expect(lot).toBeDefined();
    });

    it('throws when lot not found', async () => {
      repo = makeRepo({ update: vi.fn().mockResolvedValue(null) });
      service = new ParkingService(repo);
      await expect(service.updateLot('missing', 'tenant-1', { name: 'X' })).rejects.toThrow(ParkingLotNotFoundError);
    });
  });

  describe('deleteLot', () => {
    it('deletes a parking lot', async () => {
      await expect(service.deleteLot('lot-1', 'tenant-1')).resolves.toBeUndefined();
    });

    it('throws when lot not found', async () => {
      repo = makeRepo({ delete: vi.fn().mockResolvedValue(false) });
      service = new ParkingService(repo);
      await expect(service.deleteLot('missing', 'tenant-1')).rejects.toThrow(ParkingLotNotFoundError);
    });
  });

  describe('listParkedCalls', () => {
    it('returns parked calls for a lot', async () => {
      const calls = await service.listParkedCalls('lot-1', 'tenant-1');
      expect(calls).toHaveLength(1);
    });

    it('throws when lot not found', async () => {
      repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
      service = new ParkingService(repo);
      await expect(service.listParkedCalls('missing', 'tenant-1')).rejects.toThrow(ParkingLotNotFoundError);
    });
  });

  describe('recordPark', () => {
    it('parks a call in the matching lot', async () => {
      const call = await service.recordPark('tenant-1', 801, 'call-uuid', '101');
      expect(call.slot).toBe(801);
      expect(vi.mocked(repo.parkCall)).toHaveBeenCalled();
    });

    it('throws ParkingSlotNotFoundError when no lot covers the slot', async () => {
      repo = makeRepo({ findByTenantAndSlot: vi.fn().mockResolvedValue(null) });
      service = new ParkingService(repo);
      await expect(service.recordPark('tenant-1', 999, 'call')).rejects.toThrow(ParkingSlotNotFoundError);
    });

    it('throws ParkingSlotConflictError when slot already occupied', async () => {
      repo = makeRepo({ findActiveParkedCallBySlot: vi.fn().mockResolvedValue(makeCall()) });
      service = new ParkingService(repo);
      await expect(service.recordPark('tenant-1', 801, 'call')).rejects.toThrow(ParkingSlotConflictError);
    });
  });

  describe('recordRetrieve', () => {
    it('marks call as retrieved', async () => {
      const call = await service.recordRetrieve('tenant-1', 801);
      expect(call.status).toBe('retrieved');
    });

    it('throws when no active parked call at slot', async () => {
      repo = makeRepo({ retrieveCall: vi.fn().mockResolvedValue(null) });
      service = new ParkingService(repo);
      await expect(service.recordRetrieve('tenant-1', 801)).rejects.toThrow(ParkingLotNotFoundError);
    });
  });

  describe('recordTimeout', () => {
    it('marks call as timed out', async () => {
      const call = await service.recordTimeout('tenant-1', 801);
      expect(call.status).toBe('timed_out');
    });

    it('throws when no active parked call at slot', async () => {
      repo = makeRepo({ timeoutCall: vi.fn().mockResolvedValue(null) });
      service = new ParkingService(repo);
      await expect(service.recordTimeout('tenant-1', 801)).rejects.toThrow(ParkingLotNotFoundError);
    });
  });

  describe('tenant isolation', () => {
    it('listLots uses tenant_id scoping', async () => {
      await service.listLots('tenant-2');
      expect(vi.mocked(repo.findAllByTenant)).toHaveBeenCalledWith('tenant-2');
    });

    it('getLotById scopes by tenant', async () => {
      await service.getLotById('lot-1', 'tenant-2');
      expect(vi.mocked(repo.findById)).toHaveBeenCalledWith('lot-1', 'tenant-2');
    });
  });
});
