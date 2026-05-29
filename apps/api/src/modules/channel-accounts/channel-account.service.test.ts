import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChannelAccountService, ChannelAccountNotFoundError } from './channel-account.service.js';
import type { ChannelAccountRepository } from './channel-account.repository.js';
import type { ChannelAccount } from './channel-account.types.js';

const TENANT = 'tenant-1';

const baseAccount: ChannelAccount = {
  id: 'acct-1',
  tenant_id: TENANT,
  provider_type: 'whatsapp',
  name: 'WhatsApp Business',
  status: 'active',
  capabilities: ['voice_message', 'native_call'],
  provider_config: {},
  created_at: new Date(),
  updated_at: new Date(),
};

function makeRepo(overrides: Partial<ChannelAccountRepository> = {}): ChannelAccountRepository {
  return {
    create: vi.fn().mockResolvedValue(baseAccount),
    findById: vi.fn().mockResolvedValue(baseAccount),
    findByTenant: vi.fn().mockResolvedValue([baseAccount]),
    update: vi.fn().mockResolvedValue({ ...baseAccount, name: 'Updated' }),
    deactivate: vi.fn().mockResolvedValue({ ...baseAccount, status: 'inactive' }),
    ...overrides,
  } as unknown as ChannelAccountRepository;
}

describe('ChannelAccountService', () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: ChannelAccountService;

  beforeEach(() => {
    repo = makeRepo();
    service = new ChannelAccountService(repo);
  });

  it('creates a channel account', async () => {
    const result = await service.create({
      tenant_id: TENANT,
      provider_type: 'whatsapp',
      name: 'WhatsApp Business',
    });
    expect(result.id).toBe(baseAccount.id);
  });

  it('getById returns account when found', async () => {
    const result = await service.getById('acct-1', TENANT);
    expect(result.provider_type).toBe('whatsapp');
  });

  it('getById throws ChannelAccountNotFoundError when missing', async () => {
    repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
    service = new ChannelAccountService(repo);
    await expect(service.getById('missing', TENANT)).rejects.toBeInstanceOf(ChannelAccountNotFoundError);
  });

  it('listByTenant returns accounts', async () => {
    const result = await service.listByTenant(TENANT);
    expect(result).toHaveLength(1);
    expect(vi.mocked(repo.findByTenant)).toHaveBeenCalledWith(TENANT);
  });

  it('update returns updated account', async () => {
    const result = await service.update('acct-1', TENANT, { name: 'Updated' });
    expect(result.name).toBe('Updated');
  });

  it('update throws ChannelAccountNotFoundError when not found', async () => {
    repo = makeRepo({ update: vi.fn().mockResolvedValue(null) });
    service = new ChannelAccountService(repo);
    await expect(service.update('missing', TENANT, { name: 'x' })).rejects.toBeInstanceOf(ChannelAccountNotFoundError);
  });

  it('deactivate returns inactive account', async () => {
    const result = await service.deactivate('acct-1', TENANT);
    expect(result.status).toBe('inactive');
  });

  it('deactivate throws ChannelAccountNotFoundError when not found', async () => {
    repo = makeRepo({ deactivate: vi.fn().mockResolvedValue(null) });
    service = new ChannelAccountService(repo);
    await expect(service.deactivate('missing', TENANT)).rejects.toBeInstanceOf(ChannelAccountNotFoundError);
  });
});
