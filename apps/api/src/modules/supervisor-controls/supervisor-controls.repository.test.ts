import { describe, it, expect, vi } from 'vitest';
import type { Pool } from 'pg';
import { SupervisorControlsRepository } from './supervisor-controls.repository.js';
import type { SupervisorControl } from './supervisor-controls.types.js';

const TENANT = 'tenant-1';
const CTRL_ID = 'ctrl-1';

const base: SupervisorControl = {
  id: CTRL_ID, tenant_id: TENANT, supervisor_user_id: 'user-1',
  control_type: 'listen', target_call_id: 'call-1', status: 'active',
  audit_note: null, created_at: new Date(), updated_at: new Date(), ended_at: null,
};

function makePool(rows: unknown[] = []): Pool {
  return { query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }) } as unknown as Pool;
}

describe('SupervisorControlsRepository', () => {
  it('findAllByTenant returns all controls', async () => {
    const pool = makePool([base]);
    expect(await new SupervisorControlsRepository(pool).findAllByTenant(TENANT)).toHaveLength(1);
  });

  it('findById returns control when found', async () => {
    const pool = makePool([base]);
    expect((await new SupervisorControlsRepository(pool).findById(CTRL_ID, TENANT))?.id).toBe(CTRL_ID);
  });

  it('findById returns null when not found', async () => {
    const pool = makePool([]);
    expect(await new SupervisorControlsRepository(pool).findById('missing', TENANT)).toBeNull();
  });

  it('create inserts control and returns it', async () => {
    const pool = makePool([base]);
    const result = await new SupervisorControlsRepository(pool).create({
      tenant_id: TENANT, supervisor_user_id: 'user-1', control_type: 'listen',
      target_call_id: 'call-1', audit_note: 'testing',
    });
    expect(result.control_type).toBe('listen');
  });

  it('update with status active returns updated control', async () => {
    const updated = { ...base, status: 'active' as const };
    const pool = makePool([updated]);
    const result = await new SupervisorControlsRepository(pool).update(CTRL_ID, TENANT, { status: 'active' });
    expect(result?.status).toBe('active');
  });

  it('update with status ended adds ended_at clause', async () => {
    const ended = { ...base, status: 'ended' as const, ended_at: new Date() };
    const pool = makePool([ended]);
    const result = await new SupervisorControlsRepository(pool).update(CTRL_ID, TENANT, { status: 'ended' });
    expect(result?.status).toBe('ended');
  });

  it('update with audit_note only updates note', async () => {
    const updated = { ...base, audit_note: 'new note' };
    const pool = makePool([updated]);
    const result = await new SupervisorControlsRepository(pool).update(CTRL_ID, TENANT, { audit_note: 'new note' });
    expect(result?.audit_note).toBe('new note');
  });

  it('update with no fields calls findById instead', async () => {
    const pool = makePool([base]);
    const repo = new SupervisorControlsRepository(pool);
    const result = await repo.update(CTRL_ID, TENANT, {});
    expect(result?.id).toBe(CTRL_ID);
  });

  it('setStatus active does not set ended_at in SET clause', async () => {
    const pool = makePool([base]);
    const result = await new SupervisorControlsRepository(pool).setStatus(CTRL_ID, TENANT, 'active');
    expect(result?.status).toBe('active');
    const call = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).not.toContain('ended_at = NOW()');
  });

  it('setStatus ended sets ended_at in SET clause', async () => {
    const ended = { ...base, status: 'ended' as const };
    const pool = makePool([ended]);
    const result = await new SupervisorControlsRepository(pool).setStatus(CTRL_ID, TENANT, 'ended');
    expect(result?.status).toBe('ended');
    const call = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toContain('ended_at = NOW()');
  });
});
