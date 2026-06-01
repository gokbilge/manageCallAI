import { describe, it, expect, vi } from 'vitest';
import { CallEventService } from './call-event.service.js';
import type { CallEventRepository } from './call-event.repository.js';
import type { CallEvent } from './call-event.types.js';

const TENANT = 'tenant-1';
const now = new Date();

const baseEvent: CallEvent = {
  id: '00000000-0000-0000-0000-000000000001',
  tenant_id: TENANT,
  call_id: 'call-uuid-1',
  event_type: 'channel_create',
  event_time: now,
  source: 'freeswitch-esl',
  payload: { 'Event-Name': 'CHANNEL_CREATE' },
  ingested_at: now,
};

function makeRepo(overrides: Partial<CallEventRepository> = {}): CallEventRepository {
  return {
    listByTenant: vi.fn().mockResolvedValue([baseEvent]),
    create: vi.fn().mockResolvedValue(baseEvent),
    ...overrides,
  } as unknown as CallEventRepository;
}

describe('CallEventService', () => {
  describe('listByTenant', () => {
    it('returns events for the tenant', async () => {
      const repo = makeRepo();
      const service = new CallEventService(repo);
      const result = await service.listByTenant(TENANT);
      expect(result).toEqual([baseEvent]);
      expect(repo.listByTenant).toHaveBeenCalledWith(TENANT);
    });

    it('returns empty array when no events exist', async () => {
      const repo = makeRepo({ listByTenant: vi.fn().mockResolvedValue([]) });
      const service = new CallEventService(repo);
      expect(await service.listByTenant(TENANT)).toEqual([]);
    });
  });

  describe('ingest', () => {
    it('stores and returns the ingested event', async () => {
      const repo = makeRepo();
      const service = new CallEventService(repo);
      const result = await service.ingest({
        tenant_id: TENANT,
        call_id: 'call-uuid-1',
        event_type: 'channel_answer',
        source: 'freeswitch-esl',
        payload: { 'Event-Name': 'CHANNEL_ANSWER' },
      });
      expect(result).toEqual(baseEvent);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ tenant_id: TENANT, call_id: 'call-uuid-1' }),
      );
    });

    it('ingests an event without optional fields', async () => {
      const repo = makeRepo();
      const service = new CallEventService(repo);
      await service.ingest({ tenant_id: TENANT, call_id: 'c-1', event_type: 'channel_hangup' });
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ tenant_id: TENANT, call_id: 'c-1' }),
      );
    });

    it('propagates repository errors', async () => {
      const repo = makeRepo({ create: vi.fn().mockRejectedValue(new Error('DB error')) });
      await expect(
        new CallEventService(repo).ingest({ tenant_id: TENANT, call_id: 'c', event_type: 'channel_create' }),
      ).rejects.toThrow('DB error');
    });
  });
});
