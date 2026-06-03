export interface ParkingLot {
  id: string;
  tenant_id: string;
  name: string;
  slot_range_start: number;
  slot_range_end: number;
  timeout_seconds: number;
  created_at: Date;
  updated_at: Date;
}

export interface ParkedCall {
  id: string;
  tenant_id: string;
  parking_lot_id: string;
  slot: number;
  call_id: string;
  parked_by: string | null;
  status: 'parked' | 'retrieved' | 'timed_out';
  parked_at: Date;
  timeout_at: Date | null;
  retrieved_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateParkingLotInput {
  tenant_id: string;
  name: string;
  slot_range_start?: number;
  slot_range_end?: number;
  timeout_seconds?: number;
}

export interface UpdateParkingLotInput {
  name?: string;
  slot_range_start?: number;
  slot_range_end?: number;
  timeout_seconds?: number;
}

export interface ParkCallInput {
  tenant_id: string;
  slot: number;
  call_id: string;
  parked_by?: string | null;
}
