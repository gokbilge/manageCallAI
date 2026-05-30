import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QueueRepository } from './queue.repository.js';
import type { QueueWithMembers } from './queue.types.js';
import { QueueService, QueueValidationError } from './queue.service.js';

const TENANT = 'tenant-1';

const baseQueue: QueueWithMembers = {
  id: 'queue-1',
  tenant_id: TENANT,
  name: 'Support',
  description: null,
  strategy: 'simultaneous',
  ring_timeout_seconds: 20,
  retry_delay_seconds: 5,
  max_wait_seconds: 120,
  music_on_hold: null,
  overflow_target_type: null,
  overflow_target_id: null,
  status: 'active',
  created_at: new Date(),
  updated_at: new Date(),
  members: [],
};

function makeRepo(overrides: Partial<QueueRepository> = {}): QueueRepository {
  return {
    findAllByTenant: vi.fn().mockResolvedValue([baseQueue]),
    findById: vi.fn().mockResolvedValue(baseQueue),
    create: vi.fn().mockResolvedValue(baseQueue),
    update: vi.fn().mockResolvedValue(baseQueue),
    deactivate: vi.fn().mockResolvedValue({ ...baseQueue, status: 'inactive' }),
    findActiveExtension: vi.fn().mockResolvedValue({ id: 'extension-1' }),
    addMember: vi.fn(),
    removeMember: vi.fn(),
    isActiveTarget: vi.fn(),
    ...overrides,
  } as unknown as QueueRepository;
}

describe('QueueService', () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: QueueService;

  beforeEach(() => {
    repo = makeRepo();
    service = new QueueService(repo);
  });

  it('creates queues with runtime behavior fields', async () => {
    await service.create({
      tenant_id: TENANT,
      name: 'Support',
      ring_timeout_seconds: 25,
      retry_delay_seconds: 10,
      max_wait_seconds: 180,
      music_on_hold: 'local_stream://moh',
    });

    expect(vi.mocked(repo.create)).toHaveBeenCalledWith(expect.objectContaining({
      retry_delay_seconds: 10,
      max_wait_seconds: 180,
      music_on_hold: 'local_stream://moh',
    }));
  });

  it('rejects invalid queue timing values', async () => {
    await expect(service.create({
      tenant_id: TENANT,
      name: 'Bad',
      ring_timeout_seconds: 0,
    })).rejects.toBeInstanceOf(QueueValidationError);

    await expect(service.update('queue-1', TENANT, {
      max_wait_seconds: 5000,
    })).rejects.toBeInstanceOf(QueueValidationError);
  });

  it('requires overflow target type and id together', async () => {
    await expect(service.create({
      tenant_id: TENANT,
      name: 'Bad',
      overflow_target_type: 'voicemail_box',
    })).rejects.toBeInstanceOf(QueueValidationError);
  });
});
