import { describe, it, expect, vi } from 'vitest';
import type { Pool } from 'pg';
import { QueueCallbacksRepository } from './queue-callbacks.repository.js';
import type { QueueCallback } from './queue-callbacks.types.js';

const TENANT = 'tenant-1';
const CB_ID = 'cb-1';
const QUEUE_ID = 'queue-1';

const base: QueueCallback = {
  id: CB_ID, tenant_id: TENANT, queue_id: QUEUE_ID,
  caller_phone: '+15551234567', caller_name: 'Alice',
  scheduled_at: null, retry_count: 0, max_retries: 3,
  status: 'pending', created_at: new Date(), updated_at: new Date(),
};

function makePool(rows: unknown[] = []): Pool {
  return { query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }) } as unknown as Pool;
}

describe('QueueCallbacksRepository', () => {
  it('findAllByTenant returns all callbacks', async () => {
    const pool = makePool([base]);
    expect(await new QueueCallbacksRepository(pool).findAllByTenant(TENANT)).toHaveLength(1);
  });

  it('findByQueue returns callbacks for specific queue', async () => {
    const pool = makePool([base]);
    expect(await new QueueCallbacksRepository(pool).findByQueue(QUEUE_ID, TENANT)).toHaveLength(1);
  });

  it('findById returns callback when found', async () => {
    const pool = makePool([base]);
    expect((await new QueueCallbacksRepository(pool).findById(CB_ID, TENANT))?.id).toBe(CB_ID);
  });

  it('findById returns null when not found', async () => {
    const pool = makePool([]);
    expect(await new QueueCallbacksRepository(pool).findById('missing', TENANT)).toBeNull();
  });

  it('create inserts callback and returns it', async () => {
    const pool = makePool([base]);
    const result = await new QueueCallbacksRepository(pool).create({
      tenant_id: TENANT, queue_id: QUEUE_ID, caller_phone: '+15551234567',
      caller_name: 'Alice', max_retries: 3,
    });
    expect(result.caller_phone).toBe('+15551234567');
  });

  it('update with status pending increments retry_count', async () => {
    const updated = { ...base, retry_count: 1 };
    const pool = makePool([updated]);
    const result = await new QueueCallbacksRepository(pool).update(CB_ID, TENANT, { status: 'pending' });
    expect(result?.retry_count).toBe(1);
    const query = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(query).toContain('retry_count = retry_count + 1');
  });

  it('update with status reached does not increment retry_count', async () => {
    const updated = { ...base, status: 'reached' as const };
    const pool = makePool([updated]);
    const result = await new QueueCallbacksRepository(pool).update(CB_ID, TENANT, { status: 'reached' });
    expect(result?.status).toBe('reached');
    const query = (pool.query as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(query).not.toContain('retry_count = retry_count + 1');
  });

  it('update with scheduled_at sets new schedule', async () => {
    const scheduled = new Date('2026-06-10');
    const updated = { ...base, scheduled_at: scheduled };
    const pool = makePool([updated]);
    const result = await new QueueCallbacksRepository(pool).update(CB_ID, TENANT, { scheduled_at: scheduled });
    expect(result?.scheduled_at).toEqual(scheduled);
  });

  it('update with caller_name updates the name', async () => {
    const updated = { ...base, caller_name: 'Bob' };
    const pool = makePool([updated]);
    const result = await new QueueCallbacksRepository(pool).update(CB_ID, TENANT, { caller_name: 'Bob' });
    expect(result?.caller_name).toBe('Bob');
  });

  it('update with no fields calls findById instead', async () => {
    const pool = makePool([base]);
    const result = await new QueueCallbacksRepository(pool).update(CB_ID, TENANT, {});
    expect(result?.id).toBe(CB_ID);
  });

  it('findActiveByStatus returns callbacks matching any of the statuses', async () => {
    const pool = makePool([base]);
    const result = await new QueueCallbacksRepository(pool).findActiveByStatus(TENANT, ['pending', 'scheduled']);
    expect(result).toHaveLength(1);
  });

  it('findQueueExists returns true when queue found', async () => {
    const pool = makePool([{ id: QUEUE_ID }]);
    expect(await new QueueCallbacksRepository(pool).findQueueExists(QUEUE_ID, TENANT)).toBe(true);
  });

  it('findQueueExists returns false when queue not found', async () => {
    const pool = makePool([]);
    expect(await new QueueCallbacksRepository(pool).findQueueExists('missing', TENANT)).toBe(false);
  });
});
