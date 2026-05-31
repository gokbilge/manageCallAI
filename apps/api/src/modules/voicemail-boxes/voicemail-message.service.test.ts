import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResourceInactiveError, TenantScopeError } from '../domain-assertions.js';
import type { VoicemailMessageRepository } from './voicemail-message.repository.js';
import {
  VoicemailMailboxNotFoundError,
  VoicemailMessageNotFoundError,
  VoicemailMessageService,
} from './voicemail-message.service.js';
import type { VoicemailMessage } from './voicemail-message.types.js';

const tenantId = '00000000-0000-0000-0000-000000000001';
const mailboxId = '00000000-0000-0000-0000-000000000002';

const sampleMessage: VoicemailMessage = {
  id: '00000000-0000-0000-0000-000000000003',
  tenant_id: tenantId,
  voicemail_box_id: mailboxId,
  call_id: 'call-1',
  storage_path: '/recordings/call-1.wav',
  duration_secs: 12,
  size_bytes: 1024,
  read_at: null,
  deleted_at: null,
  recorded_at: new Date(),
  created_at: new Date(),
};

const repo = {
  findMailboxRuntimeRef: vi.fn(),
  create: vi.fn(),
  listByMailbox: vi.fn(),
  markRead: vi.fn(),
  softDelete: vi.fn(),
} as unknown as VoicemailMessageRepository;

const service = new VoicemailMessageService(repo);

beforeEach(() => vi.clearAllMocks());

describe('VoicemailMessageService', () => {
  it('ingest verifies mailbox tenant and active status before persistence', async () => {
    vi.mocked(repo.findMailboxRuntimeRef).mockResolvedValue({ id: mailboxId, tenant_id: tenantId, status: 'active' });
    vi.mocked(repo.create).mockResolvedValue(sampleMessage);

    const result = await service.ingest({
      tenant_id: tenantId,
      voicemail_box_id: mailboxId,
      call_id: 'call-1',
      storage_path: '/recordings/call-1.wav',
    });

    expect(result).toEqual(sampleMessage);
    expect(repo.create).toHaveBeenCalledOnce();
  });

  it('ingest rejects missing mailbox without creating a message', async () => {
    vi.mocked(repo.findMailboxRuntimeRef).mockResolvedValue(null);

    await expect(service.ingest({
      tenant_id: tenantId,
      voicemail_box_id: mailboxId,
      call_id: 'call-1',
      storage_path: '/recordings/call-1.wav',
    })).rejects.toThrow(VoicemailMailboxNotFoundError);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('ingest rejects cross-tenant mailbox without creating a message', async () => {
    vi.mocked(repo.findMailboxRuntimeRef).mockResolvedValue({
      id: mailboxId,
      tenant_id: '00000000-0000-0000-0000-000000000099',
      status: 'active',
    });

    await expect(service.ingest({
      tenant_id: tenantId,
      voicemail_box_id: mailboxId,
      call_id: 'call-1',
      storage_path: '/recordings/call-1.wav',
    })).rejects.toThrow(TenantScopeError);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('ingest rejects inactive mailbox without creating a message', async () => {
    vi.mocked(repo.findMailboxRuntimeRef).mockResolvedValue({ id: mailboxId, tenant_id: tenantId, status: 'inactive' });

    await expect(service.ingest({
      tenant_id: tenantId,
      voicemail_box_id: mailboxId,
      call_id: 'call-1',
      storage_path: '/recordings/call-1.wav',
    })).rejects.toThrow(ResourceInactiveError);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('markRead and delete report missing messages through domain errors', async () => {
    vi.mocked(repo.markRead).mockResolvedValue(null);
    vi.mocked(repo.softDelete).mockResolvedValue(false);

    await expect(service.markRead(sampleMessage.id, tenantId)).rejects.toThrow(VoicemailMessageNotFoundError);
    await expect(service.delete(sampleMessage.id, tenantId)).rejects.toThrow(VoicemailMessageNotFoundError);
  });
});
