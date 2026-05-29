import type { ChannelMessageRepository } from './channel-message.repository.js';
import type {
  ChannelMessage,
  ChannelMessageRequest,
  CreateOutboundMessageInput,
  IngestInboundMessageInput,
} from './channel-message.types.js';

export class ChannelAccountInvalidError extends Error {
  constructor(id: string) { super(`Channel account not found or inactive: ${id}`); this.name = 'ChannelAccountInvalidError'; }
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
}
