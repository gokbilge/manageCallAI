import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QueueCallbacksRepository } from './queue-callbacks.repository.js';
import type { QueueCallback } from './queue-callbacks.types.js';
import {
  QueueCallbackNotFoundError,
  QueueCallbackTransitionError,
  QueueCallbackValidationError,
  QueueCallbacksService,
} from './queue-callbacks.service.js';

const TENANT = 'tenant-1';
const QUEUE_ID = 'queue-1';
const CB_ID = 'cb-1';

const baseCallback: QueueCallback = {
  id: CB_ID,
  tenant_id: TENANT,
  queue_id: QUEUE_ID,
  caller_phone: '+15551234567',
  caller_name: 'Alice',
  scheduled_at: null as string | null,
  retry_count: 0,
  max_retries: 3,
  status: 'pending',
  created_at: new Date(),
  updated_at: new Date(),
};

function makeRepo(overrides: Partial<QueueCallbacksRepository> = {}): QueueCallbacksRepository {
  return {
    findAllByTenant: vi.fn().mockResolvedValue([baseCallback]),
    findByQueue: vi.fn().mockResolvedValue([baseCallback]),
    findById: vi.fn().mockResolvedValue(baseCallback),
    create: vi.fn().mockResolvedValue(baseCallback),
    update: vi.fn().mockResolvedValue(baseCallback),
    findActiveByStatus: vi.fn().mockResolvedValue([]),
    findQueueExists: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as unknown as QueueCallbacksRepository;
}

describe('QueueCallbacksService', () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: QueueCallbacksService;

  beforeEach(() => {
    repo = makeRepo();
    service = new QueueCallbacksService(repo);
  });

  it('creates a callback', async () => {
    await service.create(QUEUE_ID, { tenant_id: TENANT, queue_id: QUEUE_ID, caller_phone: '+15551234567' });
    expect(vi.mocked(repo.create)).toHaveBeenCalled();
  });

  it('rejects empty caller_phone', async () => {
    await expect(service.create(QUEUE_ID, { tenant_id: TENANT, queue_id: QUEUE_ID, caller_phone: '  ' }))
      .rejects.toBeInstanceOf(QueueCallbackValidationError);
  });

  it('rejects when queue does not exist', async () => {
    repo = makeRepo({ findQueueExists: vi.fn().mockResolvedValue(false) });
    service = new QueueCallbacksService(repo);
    await expect(service.create(QUEUE_ID, { tenant_id: TENANT, queue_id: QUEUE_ID, caller_phone: '+1' }))
      .rejects.toBeInstanceOf(QueueCallbackValidationError);
  });

  it('rejects invalid max_retries', async () => {
    await expect(service.create(QUEUE_ID, { tenant_id: TENANT, queue_id: QUEUE_ID, caller_phone: '+1', max_retries: 11 }))
      .rejects.toBeInstanceOf(QueueCallbackValidationError);
  });

  it('throws not-found when callback missing', async () => {
    repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
    service = new QueueCallbacksService(repo);
    await expect(service.getById('missing', TENANT)).rejects.toBeInstanceOf(QueueCallbackNotFoundError);
  });

  it('allows valid transition: pending → scheduled', async () => {
    await service.update(CB_ID, TENANT, { status: 'scheduled' });
    expect(vi.mocked(repo.update)).toHaveBeenCalled();
  });

  it('rejects invalid transition: reached → pending', async () => {
    repo = makeRepo({ findById: vi.fn().mockResolvedValue({ ...baseCallback, status: 'reached' }) });
    service = new QueueCallbacksService(repo);
    await expect(service.update(CB_ID, TENANT, { status: 'pending' }))
      .rejects.toBeInstanceOf(QueueCallbackTransitionError);
  });

  it('rejects retry when max_retries exhausted', async () => {
    repo = makeRepo({ findById: vi.fn().mockResolvedValue({ ...baseCallback, status: 'calling', retry_count: 3, max_retries: 3 }) });
    service = new QueueCallbacksService(repo);
    await expect(service.update(CB_ID, TENANT, { status: 'pending' }))
      .rejects.toBeInstanceOf(QueueCallbackValidationError);
  });

  it('cancel() sets status to cancelled', async () => {
    const updated: QueueCallback = { ...baseCallback, status: 'cancelled' };
    repo = makeRepo({ update: vi.fn().mockResolvedValue(updated) });
    service = new QueueCallbacksService(repo);
    const result = await service.cancel(CB_ID, TENANT);
    expect(result.status).toBe('cancelled');
  });

  it('cancel() is idempotent on terminal status', async () => {
    repo = makeRepo({ findById: vi.fn().mockResolvedValue({ ...baseCallback, status: 'cancelled' }) });
    service = new QueueCallbacksService(repo);
    const result = await service.cancel(CB_ID, TENANT);
    expect(result.status).toBe('cancelled');
    expect(vi.mocked(repo.update)).not.toHaveBeenCalled();
  });
});
