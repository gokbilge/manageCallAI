import type { ParkingLotRepository } from './parking-lot.repository.js';
import type {
  CreateParkingLotInput,
  ParkedCall,
  ParkingLot,
  UpdateParkingLotInput,
} from './parking-lot.types.js';

export class ParkingLotNotFoundError extends Error {
  constructor(id: string) {
    super(`Parking lot not found: ${id}`);
    this.name = 'ParkingLotNotFoundError';
  }
}

export class ParkingSlotConflictError extends Error {
  constructor(slot: number) {
    super(`Slot ${slot} is already occupied`);
    this.name = 'ParkingSlotConflictError';
  }
}

export class ParkingSlotNotFoundError extends Error {
  constructor(slot: number) {
    super(`No parking lot found for slot ${slot}`);
    this.name = 'ParkingSlotNotFoundError';
  }
}

export class ParkingService {
  constructor(private readonly repo: ParkingLotRepository) {}

  async listLots(tenantId: string): Promise<ParkingLot[]> {
    return this.repo.findAllByTenant(tenantId);
  }

  async getLotById(id: string, tenantId: string): Promise<ParkingLot> {
    const lot = await this.repo.findById(id, tenantId);
    if (!lot) throw new ParkingLotNotFoundError(id);
    return lot;
  }

  async createLot(input: CreateParkingLotInput): Promise<ParkingLot> {
    return this.repo.create(input);
  }

  async updateLot(id: string, tenantId: string, input: UpdateParkingLotInput): Promise<ParkingLot> {
    const lot = await this.repo.update(id, tenantId, input);
    if (!lot) throw new ParkingLotNotFoundError(id);
    return lot;
  }

  async deleteLot(id: string, tenantId: string): Promise<void> {
    const deleted = await this.repo.delete(id, tenantId);
    if (!deleted) throw new ParkingLotNotFoundError(id);
  }

  async listParkedCalls(lotId: string, tenantId: string): Promise<ParkedCall[]> {
    const lot = await this.repo.findById(lotId, tenantId);
    if (!lot) throw new ParkingLotNotFoundError(lotId);
    return this.repo.findParkedCallsByLot(lotId, tenantId);
  }

  // Called by Go agent CHANNEL_PARK callback.
  async recordPark(tenantId: string, slot: number, callId: string, parkedBy?: string | null): Promise<ParkedCall> {
    const lot = await this.repo.findByTenantAndSlot(tenantId, slot);
    if (!lot) throw new ParkingSlotNotFoundError(slot);

    const existing = await this.repo.findActiveParkedCallBySlot(tenantId, slot);
    if (existing) throw new ParkingSlotConflictError(slot);

    return this.repo.parkCall({ tenant_id: tenantId, slot, call_id: callId, parked_by: parkedBy ?? null }, lot.id, lot.timeout_seconds);
  }

  // Called by Go agent CHANNEL_UNPARK callback.
  async recordRetrieve(tenantId: string, slot: number): Promise<ParkedCall> {
    const call = await this.repo.retrieveCall(tenantId, slot);
    if (!call) throw new ParkingLotNotFoundError(`slot-${slot}`);
    return call;
  }

  // Called by Go agent timeout callback.
  async recordTimeout(tenantId: string, slot: number): Promise<ParkedCall> {
    const call = await this.repo.timeoutCall(tenantId, slot);
    if (!call) throw new ParkingLotNotFoundError(`slot-${slot}`);
    return call;
  }
}
