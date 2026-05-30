import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChannelMessageService, ChannelAccountInvalidError } from './channel-message.service.js';
import type { ChannelMessageRepository } from './channel-message.repository.js';
import type { ChannelMessage, ChannelMessageRequest } from './channel-message.types.js';

const TENANT = 'tenant-1';
const ACCOUNT_ID = 'acct-1';

const baseMsg: ChannelMessage = {
  id: 'msg-1',
  tenant_id: TENANT,
  channel_account_id: ACCOUNT_ID,
  direction: 'inbound',
  message_type: 'text',
  external_id: 'ext-001',
  sender_id: '+905551234567',
  recipient_id: null,
  body: 'Hello',
  media_reference: null,
  provider_metadata: {},
  received_at: new Date(),
  created_at: new Date(),
};

const baseReq: ChannelMessageRequest = {
  id: 'req-1',
  tenant_id: TENANT,
  channel_account_id: ACCOUNT_ID,
  recipient_id: '+905551234567',
  message_type: 'text',
  body: 'Hi',
  media_reference: null,
  status: 'queued',
  failure_reason: null,
  processor_id: null,
  claimed_at: null,
  completed_at: null,
  external_id: null,
  provider_metadata: {},
  created_at: new Date(),
  updated_at: new Date(),
};

function makeRepo(overrides: Partial<ChannelMessageRepository> = {}): ChannelMessageRepository {
  return {
    ingestInbound: vi.fn().mockResolvedValue(baseMsg),
    createOutboundRequest: vi.fn().mockResolvedValue(baseReq),
    findMessagesByAccount: vi.fn().mockResolvedValue([baseMsg]),
    findRequestsByAccount: vi.fn().mockResolvedValue([baseReq]),
    claimNextOutboundRequest: vi.fn().mockResolvedValue({ ...baseReq, status: 'processing', processor_id: 'adapter-1' }),
    completeOutboundRequest: vi.fn().mockResolvedValue({ ...baseReq, status: 'sent', external_id: 'provider-1' }),
    findChannelAccount: vi.fn().mockResolvedValue({ id: ACCOUNT_ID }),
    ...overrides,
  } as unknown as ChannelMessageRepository;
}

describe('ChannelMessageService', () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: ChannelMessageService;

  beforeEach(() => {
    repo = makeRepo();
    service = new ChannelMessageService(repo);
  });

  describe('ingestInbound', () => {
    it('saves and returns the inbound message', async () => {
      const result = await service.ingestInbound({
        tenant_id: TENANT,
        channel_account_id: ACCOUNT_ID,
        message_type: 'text',
        body: 'Hello',
      });
      expect(result.id).toBe('msg-1');
    });

    it('throws ChannelAccountInvalidError when account not found', async () => {
      repo = makeRepo({ findChannelAccount: vi.fn().mockResolvedValue(null) });
      service = new ChannelMessageService(repo);
      await expect(
        service.ingestInbound({ tenant_id: TENANT, channel_account_id: 'bad', message_type: 'text' }),
      ).rejects.toBeInstanceOf(ChannelAccountInvalidError);
    });
  });

  describe('createOutboundRequest', () => {
    it('creates outbound request', async () => {
      const result = await service.createOutboundRequest({
        tenant_id: TENANT,
        channel_account_id: ACCOUNT_ID,
        recipient_id: '+905551234567',
        message_type: 'text',
        body: 'Hi',
      });
      expect(result.id).toBe('req-1');
      expect(result.status).toBe('queued');
    });

    it('throws ChannelAccountInvalidError when account not found', async () => {
      repo = makeRepo({ findChannelAccount: vi.fn().mockResolvedValue(null) });
      service = new ChannelMessageService(repo);
      await expect(
        service.createOutboundRequest({
          tenant_id: TENANT,
          channel_account_id: 'bad',
          recipient_id: '+1',
          message_type: 'text',
        }),
      ).rejects.toBeInstanceOf(ChannelAccountInvalidError);
    });
  });

  describe('listMessages', () => {
    it('returns messages for account', async () => {
      const result = await service.listMessages(TENANT, ACCOUNT_ID);
      expect(result).toHaveLength(1);
      expect(vi.mocked(repo.findMessagesByAccount)).toHaveBeenCalledWith(TENANT, ACCOUNT_ID);
    });
  });

  describe('listRequests', () => {
    it('returns outbound requests for account', async () => {
      const result = await service.listRequests(TENANT, ACCOUNT_ID);
      expect(result).toHaveLength(1);
      expect(vi.mocked(repo.findRequestsByAccount)).toHaveBeenCalledWith(TENANT, ACCOUNT_ID);
    });
  });

  describe('claimNextOutboundRequest', () => {
    it('claims the next queued request for an adapter', async () => {
      const result = await service.claimNextOutboundRequest({
        tenant_id: TENANT,
        channel_account_id: ACCOUNT_ID,
        processor_id: 'adapter-1',
      });
      expect(result?.status).toBe('processing');
      expect(vi.mocked(repo.claimNextOutboundRequest)).toHaveBeenCalledWith({
        tenant_id: TENANT,
        channel_account_id: ACCOUNT_ID,
        processor_id: 'adapter-1',
      });
    });

    it('validates account scope when claiming for one account', async () => {
      repo = makeRepo({ findChannelAccount: vi.fn().mockResolvedValue(null) });
      service = new ChannelMessageService(repo);
      await expect(
        service.claimNextOutboundRequest({ tenant_id: TENANT, channel_account_id: 'bad' }),
      ).rejects.toBeInstanceOf(ChannelAccountInvalidError);
    });
  });

  describe('completeOutboundRequest', () => {
    it('marks a processing request sent', async () => {
      const result = await service.completeOutboundRequest('req-1', {
        status: 'sent',
        external_id: 'provider-1',
      });
      expect(result.status).toBe('sent');
      expect(result.external_id).toBe('provider-1');
    });
  });
});
