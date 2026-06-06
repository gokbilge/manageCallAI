import { encryptSipPassword } from '../../crypto/sip-secret.js';
import type { DeviceRepository } from './device.repository.js';
import type {
  AssignInput,
  CreateDeviceInput,
  Device,
  DeviceRegistration,
  ExtensionAssignment,
  RecordRegistrationInput,
  UpdateDeviceInput,
} from './device.types.js';

export class DeviceNotFoundError extends Error {
  constructor(id: string) { super(`Device not found: ${id}`); this.name = 'DeviceNotFoundError'; }
}

export class DeviceAssignmentNotFoundError extends Error {
  constructor(id: string) { super(`Assignment not found: ${id}`); this.name = 'DeviceAssignmentNotFoundError'; }
}

export class DeviceService {
  constructor(private readonly repo: DeviceRepository) {}

  // ── Devices (#308) ────────────────────────────────────────────────────────

  async create(tenantId: string, input: CreateDeviceInput): Promise<Device> {
    let ciphertext: string | null = null;
    let keyId: string | null = null;
    if (input.sip_password) {
      const enc = encryptSipPassword(input.sip_password);
      ciphertext = enc.ciphertext;
      keyId = enc.keyId;
    }
    return this.repo.create(
      tenantId,
      input.name,
      input.device_type ?? 'other',
      input.mac_address ?? null,
      input.sip_username ?? null,
      ciphertext,
      keyId,
      input.metadata ?? {},
    );
  }

  list(tenantId: string): Promise<Device[]> {
    return this.repo.findAll(tenantId);
  }

  async getById(id: string, tenantId: string): Promise<Device> {
    const device = await this.repo.findById(id, tenantId);
    if (!device) throw new DeviceNotFoundError(id);
    return device;
  }

  async update(id: string, tenantId: string, input: UpdateDeviceInput): Promise<Device> {
    let ciphertext: string | undefined;
    let keyId: string | undefined;
    if (input.sip_password) {
      const enc = encryptSipPassword(input.sip_password);
      ciphertext = enc.ciphertext;
      keyId = enc.keyId;
    }
    const device = await this.repo.update(id, tenantId, input, ciphertext, keyId);
    if (!device) throw new DeviceNotFoundError(id);
    return device;
  }

  async deprovision(id: string, tenantId: string): Promise<Device> {
    const device = await this.repo.updateStatus(id, tenantId, 'deprovisioned');
    if (!device) throw new DeviceNotFoundError(id);
    return device;
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const deleted = await this.repo.delete(id, tenantId);
    if (!deleted) throw new DeviceNotFoundError(id);
  }

  // ── Registrations (#309) ──────────────────────────────────────────────────

  recordRegistration(tenantId: string, input: RecordRegistrationInput): Promise<DeviceRegistration> {
    return this.repo.recordRegistration(tenantId, input);
  }

  listRegistrations(tenantId: string, deviceId?: string, extensionId?: string): Promise<DeviceRegistration[]> {
    return this.repo.listRegistrations(tenantId, deviceId, extensionId);
  }

  async expireRegistration(id: string, tenantId: string): Promise<void> {
    const expired = await this.repo.expireRegistration(id, tenantId);
    if (!expired) throw new DeviceAssignmentNotFoundError(id);
  }

  // ── Assignments (#310) ────────────────────────────────────────────────────

  assign(tenantId: string, input: AssignInput): Promise<ExtensionAssignment> {
    return this.repo.assign(tenantId, input);
  }

  async unassign(assignmentId: string, tenantId: string): Promise<void> {
    const deleted = await this.repo.unassign(assignmentId, tenantId);
    if (!deleted) throw new DeviceAssignmentNotFoundError(assignmentId);
  }

  listAssignments(tenantId: string, extensionId: string): Promise<ExtensionAssignment[]> {
    return this.repo.listAssignments(tenantId, extensionId);
  }

  listAssignmentsByAssignable(tenantId: string, assignableType: 'user' | 'device', assignableId: string): Promise<ExtensionAssignment[]> {
    return this.repo.listAssignmentsByAssignable(tenantId, assignableType, assignableId);
  }
}
