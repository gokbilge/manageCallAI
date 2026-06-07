import { describe, it, expect, vi } from 'vitest';
import type { Pool } from 'pg';
import { LineAppearanceRepository } from './line-appearance.repository.js';
import type { LineAppearance, DeviceAppearanceAssignment } from './line-appearance.types.js';

const TENANT = 'tenant-1';
const LA_ID = 'la-1';
const DEV_ID = 'dev-1';
const EXT_ID = 'ext-1';
const ASSIGN_ID = 'assign-1';

const baseAppearance: LineAppearance = {
  id: LA_ID, tenant_id: TENANT, extension_id: EXT_ID, label: 'Line 1',
  appearance_index: 0, status: 'active', metadata: {},
  created_at: new Date(), updated_at: new Date(),
};

const baseAssignment: DeviceAppearanceAssignment = {
  id: ASSIGN_ID, tenant_id: TENANT, device_id: DEV_ID,
  line_appearance_id: LA_ID, button_index: 1, created_at: new Date(),
};

function makePool(rows: unknown[] = []): Pool {
  return { query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }) } as unknown as Pool;
}

describe('LineAppearanceRepository', () => {
  it('create inserts line appearance and returns it', async () => {
    const pool = makePool([baseAppearance]);
    const repo = new LineAppearanceRepository(pool);
    const result = await repo.create(TENANT, EXT_ID, 'Line 1', 0, {});
    expect(result.label).toBe('Line 1');
    expect(result.appearance_index).toBe(0);
  });

  it('findAll without extensionId returns all appearances', async () => {
    const pool = makePool([baseAppearance]);
    const repo = new LineAppearanceRepository(pool);
    const result = await repo.findAll(TENANT);
    expect(result).toHaveLength(1);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('tenant_id = $1'), [TENANT]);
  });

  it('findAll with extensionId filters by extension', async () => {
    const pool = makePool([baseAppearance]);
    const repo = new LineAppearanceRepository(pool);
    const result = await repo.findAll(TENANT, EXT_ID);
    expect(result).toHaveLength(1);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('extension_id = $2'), [TENANT, EXT_ID]);
  });

  it('findById returns appearance when found', async () => {
    const pool = makePool([baseAppearance]);
    const repo = new LineAppearanceRepository(pool);
    const result = await repo.findById(LA_ID, TENANT);
    expect(result?.id).toBe(LA_ID);
  });

  it('findById returns null when not found', async () => {
    const pool = makePool([]);
    const repo = new LineAppearanceRepository(pool);
    expect(await repo.findById('missing', TENANT)).toBeNull();
  });

  it('update builds dynamic SET and returns updated appearance', async () => {
    const updated = { ...baseAppearance, label: 'Updated' };
    const pool = makePool([updated]);
    const repo = new LineAppearanceRepository(pool);
    const result = await repo.update(LA_ID, TENANT, {
      label: 'Updated', appearance_index: 1, status: 'inactive', metadata: { key: 'val' },
    });
    expect(result?.label).toBe('Updated');
  });

  it('update returns null when not found', async () => {
    const pool = makePool([]);
    const repo = new LineAppearanceRepository(pool);
    expect(await repo.update('missing', TENANT, { label: 'X' })).toBeNull();
  });

  it('delete returns true when deleted', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }) } as unknown as Pool;
    expect(await new LineAppearanceRepository(pool).delete(LA_ID, TENANT)).toBe(true);
  });

  it('delete returns false when not found', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) } as unknown as Pool;
    expect(await new LineAppearanceRepository(pool).delete('missing', TENANT)).toBe(false);
  });

  it('assignToDevice upserts and returns assignment', async () => {
    const pool = makePool([baseAssignment]);
    const repo = new LineAppearanceRepository(pool);
    const result = await repo.assignToDevice(TENANT, { device_id: DEV_ID, line_appearance_id: LA_ID, button_index: 1 });
    expect(result.device_id).toBe(DEV_ID);
    expect(result.button_index).toBe(1);
  });

  it('removeFromDevice returns true when deleted', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }) } as unknown as Pool;
    expect(await new LineAppearanceRepository(pool).removeFromDevice(ASSIGN_ID, TENANT)).toBe(true);
  });

  it('removeFromDevice returns false when not found', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) } as unknown as Pool;
    expect(await new LineAppearanceRepository(pool).removeFromDevice('missing', TENANT)).toBe(false);
  });

  it('listByDevice returns assignments for device', async () => {
    const pool = makePool([baseAssignment]);
    const repo = new LineAppearanceRepository(pool);
    const result = await repo.listByDevice(TENANT, DEV_ID);
    expect(result).toHaveLength(1);
  });

  it('listByAppearance returns assignments for appearance', async () => {
    const pool = makePool([baseAssignment]);
    const repo = new LineAppearanceRepository(pool);
    const result = await repo.listByAppearance(TENANT, LA_ID);
    expect(result).toHaveLength(1);
  });
});
