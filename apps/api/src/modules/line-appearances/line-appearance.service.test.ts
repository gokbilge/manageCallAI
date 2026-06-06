import { describe, it, expect, vi } from 'vitest';
import type { LineAppearanceRepository } from './line-appearance.repository.js';
import {
  LineAppearanceService,
  LineAppearanceNotFoundError,
  AppearanceAssignmentNotFoundError,
} from './line-appearance.service.js';
import type { LineAppearance, DeviceAppearanceAssignment } from './line-appearance.types.js';

const TENANT = 'tenant-1';
const LA_ID = 'la-1';
const DEV_ID = 'dev-1';
const EXT_ID = 'ext-1';
const ASSIGN_ID = 'assign-1';

const appearance: LineAppearance = {
  id: LA_ID, tenant_id: TENANT, extension_id: EXT_ID, label: 'Line 1',
  appearance_index: 0, status: 'active', metadata: {},
  created_at: new Date(), updated_at: new Date(),
};

const assignment: DeviceAppearanceAssignment = {
  id: ASSIGN_ID, tenant_id: TENANT, device_id: DEV_ID,
  line_appearance_id: LA_ID, button_index: 1, created_at: new Date(),
};

function makeRepo(overrides: Partial<LineAppearanceRepository> = {}): LineAppearanceRepository {
  return {
    create: vi.fn().mockResolvedValue(appearance),
    findAll: vi.fn().mockResolvedValue([appearance]),
    findById: vi.fn().mockResolvedValue(appearance),
    update: vi.fn().mockResolvedValue({ ...appearance, label: 'Updated' }),
    delete: vi.fn().mockResolvedValue(true),
    assignToDevice: vi.fn().mockResolvedValue(assignment),
    removeFromDevice: vi.fn().mockResolvedValue(true),
    listByDevice: vi.fn().mockResolvedValue([assignment]),
    listByAppearance: vi.fn().mockResolvedValue([assignment]),
    ...overrides,
  } as unknown as LineAppearanceRepository;
}

describe('LineAppearanceService — line appearances (#314)', () => {
  it('creates a line appearance with defaults', async () => {
    const svc = new LineAppearanceService(makeRepo());
    const r = await svc.create(TENANT, { extension_id: EXT_ID, label: 'Line 1' });
    expect(r.label).toBe('Line 1');
    expect(r.appearance_index).toBe(0);
  });

  it('creates with explicit appearance_index and metadata', async () => {
    const repo = makeRepo();
    const svc = new LineAppearanceService(repo);
    await svc.create(TENANT, { extension_id: EXT_ID, label: 'Line 2', appearance_index: 1, metadata: { key: 'val' } });
    expect(repo.create).toHaveBeenCalledWith(TENANT, EXT_ID, 'Line 2', 1, { key: 'val' });
  });

  it('lists appearances without extension_id filter', async () => {
    const svc = new LineAppearanceService(makeRepo());
    expect(await svc.list(TENANT)).toHaveLength(1);
  });

  it('lists appearances filtered by extension_id', async () => {
    const repo = makeRepo();
    const svc = new LineAppearanceService(repo);
    await svc.list(TENANT, EXT_ID);
    expect(repo.findAll).toHaveBeenCalledWith(TENANT, EXT_ID);
  });

  it('gets an appearance by id', async () => {
    const svc = new LineAppearanceService(makeRepo());
    expect((await svc.getById(LA_ID, TENANT)).id).toBe(LA_ID);
  });

  it('throws LineAppearanceNotFoundError when appearance missing', async () => {
    const svc = new LineAppearanceService(makeRepo({ findById: vi.fn().mockResolvedValue(null) }));
    await expect(svc.getById('missing', TENANT)).rejects.toBeInstanceOf(LineAppearanceNotFoundError);
  });

  it('updates a line appearance', async () => {
    const svc = new LineAppearanceService(makeRepo());
    const r = await svc.update(LA_ID, TENANT, { label: 'Updated' });
    expect(r.label).toBe('Updated');
  });

  it('throws LineAppearanceNotFoundError when update target missing', async () => {
    const svc = new LineAppearanceService(makeRepo({ update: vi.fn().mockResolvedValue(null) }));
    await expect(svc.update('missing', TENANT, { label: 'X' })).rejects.toBeInstanceOf(LineAppearanceNotFoundError);
  });

  it('deletes an appearance', async () => {
    const svc = new LineAppearanceService(makeRepo());
    await expect(svc.delete(LA_ID, TENANT)).resolves.toBeUndefined();
  });

  it('throws LineAppearanceNotFoundError when deleting missing appearance', async () => {
    const svc = new LineAppearanceService(makeRepo({ delete: vi.fn().mockResolvedValue(false) }));
    await expect(svc.delete('missing', TENANT)).rejects.toBeInstanceOf(LineAppearanceNotFoundError);
  });
});

describe('LineAppearanceService — device appearance assignments (#315)', () => {
  it('assigns an appearance to a device button', async () => {
    const svc = new LineAppearanceService(makeRepo());
    const r = await svc.assignToDevice(TENANT, { device_id: DEV_ID, line_appearance_id: LA_ID, button_index: 1 });
    expect(r.button_index).toBe(1);
    expect(r.device_id).toBe(DEV_ID);
  });

  it('removes a device appearance assignment', async () => {
    const svc = new LineAppearanceService(makeRepo());
    await expect(svc.removeFromDevice(ASSIGN_ID, TENANT)).resolves.toBeUndefined();
  });

  it('throws AppearanceAssignmentNotFoundError when removing missing assignment', async () => {
    const svc = new LineAppearanceService(makeRepo({ removeFromDevice: vi.fn().mockResolvedValue(false) }));
    await expect(svc.removeFromDevice('missing', TENANT)).rejects.toBeInstanceOf(AppearanceAssignmentNotFoundError);
  });

  it('lists assignments by device', async () => {
    const svc = new LineAppearanceService(makeRepo());
    expect(await svc.listByDevice(TENANT, DEV_ID)).toHaveLength(1);
  });

  it('lists assignments by appearance', async () => {
    const svc = new LineAppearanceService(makeRepo());
    expect(await svc.listByAppearance(TENANT, LA_ID)).toHaveLength(1);
  });
});
