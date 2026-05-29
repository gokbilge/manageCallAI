import type { ChannelAccountRepository } from './channel-account.repository.js';
import type { ChannelAccount, CreateChannelAccountInput, UpdateChannelAccountInput } from './channel-account.types.js';

export class ChannelAccountNotFoundError extends Error {
  constructor(id: string) { super(`Channel account not found: ${id}`); this.name = 'ChannelAccountNotFoundError'; }
}

export class ChannelAccountService {
  constructor(private readonly repo: ChannelAccountRepository) {}

  async create(input: CreateChannelAccountInput): Promise<ChannelAccount> {
    return this.repo.create(input);
  }

  async getById(id: string, tenantId: string): Promise<ChannelAccount> {
    const account = await this.repo.findById(id, tenantId);
    if (!account) throw new ChannelAccountNotFoundError(id);
    return account;
  }

  async listByTenant(tenantId: string): Promise<ChannelAccount[]> {
    return this.repo.findByTenant(tenantId);
  }

  async update(id: string, tenantId: string, input: UpdateChannelAccountInput): Promise<ChannelAccount> {
    const account = await this.repo.update(id, tenantId, input);
    if (!account) throw new ChannelAccountNotFoundError(id);
    return account;
  }

  async deactivate(id: string, tenantId: string): Promise<ChannelAccount> {
    const account = await this.repo.deactivate(id, tenantId);
    if (!account) throw new ChannelAccountNotFoundError(id);
    return account;
  }
}
