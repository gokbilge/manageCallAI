import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantScopeError } from '../domain-assertions.js';
import type { ExtensionEventRepository } from './extension-event.repository.js';
import { ExtensionEventService } from './extension-event.service.js';
import type { ExtensionEvent, IngestExtensionEventInput } from './extension-event.types.js';

const tenantId = '00000000-0000-0000-0000-000000000001';
const extensionId = '00000000-0000-0000-0000-000000000002';

const input: IngestExtensionEventInput = {
  tenant_id: tenantId,
  extension_number: '100',
  event_type: 'registered',
  contact_domain: 'pbx.example.com',
  user_agent: 'UA',
  freeswitch_event_id: 'fs-event-1',
};

const sampleEvent: ExtensionEvent = {
  id: '00000000-0000-0000-0000-000000000003',
  tenant_id: tenantId,
  extension_id: extensionId,
  extension_number: '100',
  event_type: 'registered',
  contact_domain: 'pbx.example.com',
  user_agent: 'UA',
  source_ip: null,
  freeswitch_event_id: 'fs-event-1',
  created_at: new Date(),
};

const repo = {
  findActiveExtensionId: vi.fn(),
  create: vi.fn(),
  upsertRegistration: vi.fn(),
  markRegistrationInactive: vi.fn(),
  listByExtension: vi.fn(),
} as unknown as ExtensionEventRepository;

const service = new ExtensionEventService(repo);

beforeEach(() => vi.clearAllMocks());

describe('ExtensionEventService', () => {
  it('ingests an extension event and mirrors registered state', async () => {
    vi.mocked(repo.findActiveExtensionId).mockResolvedValue(extensionId);
    vi.mocked(repo.create).mockResolvedValue(sampleEvent);

    const result = await service.ingest(input, tenantId);

    expect(result).toEqual({ event: sampleEvent, replayed: false });
    expect(repo.create).toHaveBeenCalledWith(input, extensionId);
    expect(repo.upsertRegistration).toHaveBeenCalledWith(input, extensionId);
  });

  it('rejects runtime tenant mismatch before persistence', async () => {
    await expect(service.ingest(input, '00000000-0000-0000-0000-000000000099')).rejects.toThrow(TenantScopeError);
    expect(repo.findActiveExtensionId).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('returns replayed result for idempotent duplicate events', async () => {
    vi.mocked(repo.findActiveExtensionId).mockResolvedValue(extensionId);
    vi.mocked(repo.create).mockResolvedValue(null);

    const result = await service.ingest(input, tenantId);

    expect(result).toEqual({ event: null, replayed: true });
    expect(repo.upsertRegistration).not.toHaveBeenCalled();
  });

  it('does not fail ingestion when registration projection update fails', async () => {
    vi.mocked(repo.findActiveExtensionId).mockResolvedValue(extensionId);
    vi.mocked(repo.create).mockResolvedValue(sampleEvent);
    vi.mocked(repo.upsertRegistration).mockRejectedValue(new Error('projection unavailable'));

    await expect(service.ingest(input, tenantId)).resolves.toEqual({ event: sampleEvent, replayed: false });
  });

  it('marks registration inactive for expire and unregister events', async () => {
    vi.mocked(repo.findActiveExtensionId).mockResolvedValue(extensionId);
    vi.mocked(repo.create).mockResolvedValue({ ...sampleEvent, event_type: 'expired' });

    await service.ingest({ ...input, event_type: 'expired' }, tenantId);

    expect(repo.markRegistrationInactive).toHaveBeenCalledWith({ ...input, event_type: 'expired' }, 'expired');
  });
});
