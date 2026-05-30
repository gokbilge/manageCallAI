import type { ChannelMessageRepository } from './channel-message.repository.js';
import type {
  ClaimOutboundMessageInput,
  ChannelMessage,
  ChannelMessageRequest,
  CompleteOutboundMessageInput,
  CreateOutboundMessageInput,
  IngestInboundMessageInput,
} from './channel-message.types.js';

export class ChannelAccountInvalidError extends Error {
  constructor(id: string) { super(`Channel account not found or inactive: ${id}`); this.name = 'ChannelAccountInvalidError'; }
}

export class ChannelMessageRequestNotFoundError extends Error {
  constructor(id: string) { super(`Channel message request not found or not claimable: ${id}`); this.name = 'ChannelMessageRequestNotFoundError'; }
}

export class ChannelMessageService {
  constructor(private readonly repo: ChannelMessageRepository) {}

  async ingestInbound(input: IngestInboundMessageInput): Promise<ChannelMessage> {
    const account = await this.repo.findChannelAccount(input.tenant_id, input.channel_account_id);
    if (!account) throw new ChannelAccountInvalidError(input.channel_account_id);
    return this.repo.ingestInbound(input);
  }

  async createOutboundRequest(input: CreateOutboundMessageInput): Promise<ChannelMessageRequest> {
    const account = await this.repo.findChannelAccount(input.tenant_id, input.channel_account_id);
    if (!account) throw new ChannelAccountInvalidError(input.channel_account_id);
    return this.repo.createOutboundRequest(input);
  }

  async listMessages(tenantId: string, channelAccountId: string): Promise<ChannelMessage[]> {
    return this.repo.findMessagesByAccount(tenantId, channelAccountId);
  }

  async listRequests(tenantId: string, channelAccountId: string): Promise<ChannelMessageRequest[]> {
    return this.repo.findRequestsByAccount(tenantId, channelAccountId);
  }

  async claimNextOutboundRequest(input: ClaimOutboundMessageInput): Promise<ChannelMessageRequest | null> {
    if (input.channel_account_id) {
      const account = await this.repo.findChannelAccount(input.tenant_id, input.channel_account_id);
      if (!account) throw new ChannelAccountInvalidError(input.channel_account_id);
    }
    return this.repo.claimNextOutboundRequest(input);
  }

  async completeOutboundRequest(
    requestId: string,
    input: CompleteOutboundMessageInput,
  ): Promise<ChannelMessageRequest> {
    const request = await this.repo.completeOutboundRequest(requestId, input);
    if (!request) throw new ChannelMessageRequestNotFoundError(requestId);
    return request;
  }
}
