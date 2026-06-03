import { encryptSipPassword, decryptSipPassword } from '../../crypto/sip-secret.js';
import type { ConferenceRoomRepository } from './conference-room.repository.js';
import type {
  ConferenceParticipant,
  ConferenceRoom,
  ConferenceRoomInternal,
  CreateConferenceRoomInput,
  UpdateConferenceRoomInput,
} from './conference-room.types.js';

export class ConferenceRoomNotFoundError extends Error {
  constructor(id: string) {
    super(`Conference room not found: ${id}`);
    this.name = 'ConferenceRoomNotFoundError';
  }
}

export class ConferenceRoomConflictError extends Error {
  constructor(roomNumber: string) {
    super(`Room number ${roomNumber} is already in use for this tenant`);
    this.name = 'ConferenceRoomConflictError';
  }
}

export class ConferenceService {
  constructor(private readonly repo: ConferenceRoomRepository) {}

  async list(tenantId: string): Promise<ConferenceRoom[]> {
    return this.repo.findAllByTenant(tenantId);
  }

  async getById(id: string, tenantId: string): Promise<ConferenceRoom> {
    const room = await this.repo.findById(id, tenantId);
    if (!room) throw new ConferenceRoomNotFoundError(id);
    return room;
  }

  async create(input: CreateConferenceRoomInput): Promise<ConferenceRoom> {
    let pinCiphertext: string | null = null;
    let pinKeyId: string | null = null;
    if (input.pin) {
      const encrypted = encryptSipPassword(input.pin);
      pinCiphertext = encrypted.ciphertext;
      pinKeyId = encrypted.keyId;
    }
    return this.repo.create(input, pinCiphertext, pinKeyId);
  }

  async update(id: string, tenantId: string, input: UpdateConferenceRoomInput): Promise<ConferenceRoom> {
    let pinCiphertext: string | null | undefined;
    let pinKeyId: string | null | undefined;

    if ('pin' in input) {
      if (input.pin) {
        const encrypted = encryptSipPassword(input.pin);
        pinCiphertext = encrypted.ciphertext;
        pinKeyId = encrypted.keyId;
      } else {
        // Explicitly clearing the PIN
        pinCiphertext = null;
        pinKeyId = null;
      }
    }

    const room = await this.repo.update(id, tenantId, input, pinCiphertext, pinKeyId);
    if (!room) throw new ConferenceRoomNotFoundError(id);
    return room;
  }

  async disable(id: string, tenantId: string): Promise<ConferenceRoom> {
    const room = await this.repo.setStatus(id, tenantId, 'disabled');
    if (!room) throw new ConferenceRoomNotFoundError(id);
    return room;
  }

  async enable(id: string, tenantId: string): Promise<ConferenceRoom> {
    const room = await this.repo.setStatus(id, tenantId, 'active');
    if (!room) throw new ConferenceRoomNotFoundError(id);
    return room;
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const deleted = await this.repo.delete(id, tenantId);
    if (!deleted) throw new ConferenceRoomNotFoundError(id);
  }

  // Returns decrypted PIN for FreeSWITCH mod_xml_curl dialplan.
  // NEVER use this in REST API responses.
  decryptPin(room: ConferenceRoomInternal): string | null {
    if (!room.pin_ciphertext || !room.pin_key_id) return null;
    return decryptSipPassword(room.pin_ciphertext, room.pin_key_id);
  }

  // Used by the dialplan handler — returns all active rooms with decrypted PINs
  // for building the conference dialplan context.
  async getActiveRoomsForDialplan(tenantId: string): Promise<Array<ConferenceRoomInternal & { pin_plaintext: string | null }>> {
    const rooms = await this.repo.findAllActiveByTenant(tenantId);
    return rooms.map(r => ({
      ...r,
      pin_plaintext: this.decryptPin(r),
    }));
  }

  // Participant tracking
  async recordJoin(tenantId: string, roomId: string, callId: string): Promise<ConferenceParticipant> {
    return this.repo.recordJoin(tenantId, roomId, callId);
  }

  async recordLeave(tenantId: string, roomId: string, callId: string): Promise<ConferenceParticipant | null> {
    return this.repo.recordLeave(tenantId, roomId, callId);
  }

  async listParticipants(roomId: string, tenantId: string): Promise<ConferenceParticipant[]> {
    const room = await this.repo.findById(roomId, tenantId);
    if (!room) throw new ConferenceRoomNotFoundError(roomId);
    return this.repo.findParticipants(roomId, tenantId);
  }
}
