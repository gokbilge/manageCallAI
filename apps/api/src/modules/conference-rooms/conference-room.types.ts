export interface ConferenceRoom {
  id: string;
  tenant_id: string;
  name: string;
  room_number: string;
  has_pin: boolean;  // never return the pin itself
  max_participants: number;
  record_calls: boolean;
  status: 'active' | 'disabled';
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

// Internal type with encrypted PIN — used only within the service/repository.
export interface ConferenceRoomInternal extends ConferenceRoom {
  pin_ciphertext: string | null;
  pin_key_id: string | null;
}

export interface CreateConferenceRoomInput {
  tenant_id: string;
  name: string;
  room_number: string;
  pin?: string | null;
  max_participants?: number;
  record_calls?: boolean;
  created_by?: string | null;
}

export interface UpdateConferenceRoomInput {
  name?: string;
  pin?: string | null;
  max_participants?: number;
  record_calls?: boolean;
}

export interface ConferenceParticipant {
  id: string;
  tenant_id: string;
  conference_room_id: string;
  call_id: string;
  joined_at: Date;
  left_at: Date | null;
}
