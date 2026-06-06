import { describe, it, expect, vi } from 'vitest';
import type { DeviceRepository } from './device.repository.js';
import {
  DeviceService,
  DeviceNotFoundError,
  DeviceAssignmentNotFoundError,
} from './device.service.js';
import type { Device, DeviceRegistration, ExtensionAssignment } from './device.types.js';

vi.mock('../../crypto/sip-secret.js', () => ({
  encryptSipPassword: vi.fn().mockReturnValue({ ciphertext: 'enc', keyId: 'k1' }),
}));

const TENANT = 'tenant-1';
const DEV_ID = 'dev-1';
const EXT_ID = 'ext-1';
const ASSIGN_ID = 'assign-1';
const REG_ID = 'reg-1';

const device: Device = {
  id: DEV_ID, tenant_id: TENANT, name: 'Phone A', device_type: 'desk_phone',
  mac_address: null, sip_username: 'user1', status: 'active',
  metadata: {}, created_at: new Date(), updated_at: new Date(),
};

const registration: DeviceRegistration = {
  id: REG_ID, tenant_id: TENANT, device_id: DEV_ID, extension_id: EXT_ID,
  sip_username: 'user1', registered_at: new Date(), expires_at: null,
  contact_uri: null, user_agent: null, source_ip: null, is_active: true,
};

const assignment: ExtensionAssignment = {
  id: ASSIGN_ID, tenant_id: TENANT, extension_id: EXT_ID,
  assignable_type: 'device', assignable_id: DEV_ID, is_primary: false,
  created_at: new Date(),
};

function makeRepo(overrides: Partial<DeviceRepository> = {}): DeviceRepository {
  return {
    create: vi.fn().mockResolvedValue(device),
    findAll: vi.fn().mockResolvedValue([device]),
    findById: vi.fn().mockResolvedValue(device),
    update: vi.fn().mockResolvedValue(device),
    updateStatus: vi.fn().mockResolvedValue(device),
    delete: vi.fn().mockResolvedValue(true),
    recordRegistration: vi.fn().mockResolvedValue(registration),
    listRegistrations: vi.fn().mockResolvedValue([registration]),
    expireRegistration: vi.fn().mockResolvedValue(true),
    assign: vi.fn().mockResolvedValue(assignment),
    unassign: vi.fn().mockResolvedValue(true),
    listAssignments: vi.fn().mockResolvedValue([assignment]),
    listAssignmentsByAssignable: vi.fn().mockResolvedValue([assignment]),
    ...overrides,
  } as unknown as DeviceRepository;
}

describe('DeviceService — devices (#308)', () => {
  it('creates a device without a SIP password', async () => {
    const svc = new DeviceService(makeRepo());
    const r = await svc.create(TENANT, { name: 'Phone A', device_type: 'desk_phone' });
    expect(r.name).toBe('Phone A');
  });

  it('encrypts SIP password when provided on create', async () => {
    const repo = makeRepo();
    const svc = new DeviceService(repo);
    await svc.create(TENANT, { name: 'Phone A', sip_password: 'secret1234' });
    expect(repo.create).toHaveBeenCalledWith(
      TENANT, 'Phone A', 'other', null, null, 'enc', 'k1', {},
    );
  });

  it('lists devices', async () => {
    const svc = new DeviceService(makeRepo());
    expect(await svc.list(TENANT)).toHaveLength(1);
  });

  it('gets a device by id', async () => {
    const svc = new DeviceService(makeRepo());
    expect((await svc.getById(DEV_ID, TENANT)).id).toBe(DEV_ID);
  });

  it('throws DeviceNotFoundError when device missing', async () => {
    const svc = new DeviceService(makeRepo({ findById: vi.fn().mockResolvedValue(null) }));
    await expect(svc.getById('missing', TENANT)).rejects.toBeInstanceOf(DeviceNotFoundError);
  });

  it('updates a device', async () => {
    const svc = new DeviceService(makeRepo());
    const r = await svc.update(DEV_ID, TENANT, { name: 'New Name' });
    expect(r.id).toBe(DEV_ID);
  });

  it('throws DeviceNotFoundError when update target missing', async () => {
    const svc = new DeviceService(makeRepo({ update: vi.fn().mockResolvedValue(null) }));
    await expect(svc.update('missing', TENANT, { name: 'X' })).rejects.toBeInstanceOf(DeviceNotFoundError);
  });

  it('deprovisions a device', async () => {
    const repo = makeRepo();
    const svc = new DeviceService(repo);
    await svc.deprovision(DEV_ID, TENANT);
    expect(repo.updateStatus).toHaveBeenCalledWith(DEV_ID, TENANT, 'deprovisioned');
  });

  it('throws DeviceNotFoundError when deprovisioning missing device', async () => {
    const svc = new DeviceService(makeRepo({ updateStatus: vi.fn().mockResolvedValue(null) }));
    await expect(svc.deprovision('missing', TENANT)).rejects.toBeInstanceOf(DeviceNotFoundError);
  });

  it('deletes a device', async () => {
    const svc = new DeviceService(makeRepo());
    await expect(svc.delete(DEV_ID, TENANT)).resolves.toBeUndefined();
  });

  it('throws DeviceNotFoundError when deleting missing device', async () => {
    const svc = new DeviceService(makeRepo({ delete: vi.fn().mockResolvedValue(false) }));
    await expect(svc.delete('missing', TENANT)).rejects.toBeInstanceOf(DeviceNotFoundError);
  });
});

describe('DeviceService — registrations (#309)', () => {
  it('records a registration', async () => {
    const svc = new DeviceService(makeRepo());
    const r = await svc.recordRegistration(TENANT, { sip_username: 'user1', device_id: DEV_ID });
    expect(r.sip_username).toBe('user1');
  });

  it('lists registrations', async () => {
    const svc = new DeviceService(makeRepo());
    expect(await svc.listRegistrations(TENANT, DEV_ID)).toHaveLength(1);
  });

  it('expires a registration', async () => {
    const repo = makeRepo();
    const svc = new DeviceService(repo);
    await svc.expireRegistration(REG_ID, TENANT);
    expect(repo.expireRegistration).toHaveBeenCalledWith(REG_ID, TENANT);
  });

  it('throws DeviceAssignmentNotFoundError when expiring missing registration', async () => {
    const svc = new DeviceService(makeRepo({ expireRegistration: vi.fn().mockResolvedValue(false) }));
    await expect(svc.expireRegistration('missing', TENANT)).rejects.toBeInstanceOf(DeviceAssignmentNotFoundError);
  });
});

describe('DeviceService — assignments (#310)', () => {
  it('assigns a device to an extension', async () => {
    const svc = new DeviceService(makeRepo());
    const r = await svc.assign(TENANT, {
      extension_id: EXT_ID, assignable_type: 'device', assignable_id: DEV_ID,
    });
    expect(r.assignable_type).toBe('device');
  });

  it('assigns a user to an extension', async () => {
    const svc = new DeviceService(makeRepo({
      assign: vi.fn().mockResolvedValue({ ...assignment, assignable_type: 'user', assignable_id: 'user-1' }),
    }));
    const r = await svc.assign(TENANT, {
      extension_id: EXT_ID, assignable_type: 'user', assignable_id: 'user-1', is_primary: true,
    });
    expect(r.assignable_type).toBe('user');
  });

  it('unassigns an assignment', async () => {
    const svc = new DeviceService(makeRepo());
    await expect(svc.unassign(ASSIGN_ID, TENANT)).resolves.toBeUndefined();
  });

  it('throws DeviceAssignmentNotFoundError when unassigning missing assignment', async () => {
    const svc = new DeviceService(makeRepo({ unassign: vi.fn().mockResolvedValue(false) }));
    await expect(svc.unassign('missing', TENANT)).rejects.toBeInstanceOf(DeviceAssignmentNotFoundError);
  });

  it('lists assignments for an extension', async () => {
    const svc = new DeviceService(makeRepo());
    expect(await svc.listAssignments(TENANT, EXT_ID)).toHaveLength(1);
  });

  it('lists assignments by assignable type and id', async () => {
    const svc = new DeviceService(makeRepo());
    expect(await svc.listAssignmentsByAssignable(TENANT, 'device', DEV_ID)).toHaveLength(1);
  });
});
