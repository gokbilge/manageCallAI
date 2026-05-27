import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PromptAssetRepository } from './prompt-asset.repository.js';
import { PromptAssetNotFoundError, PromptAssetService } from './prompt-asset.service.js';
import type { PromptAsset } from './prompt-asset.types.js';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const PROMPT_ID = '00000000-0000-0000-0000-000000000060';
const now = new Date();

function makePrompt(extra: Partial<PromptAsset> = {}): PromptAsset {
  return {
    id: PROMPT_ID,
    tenant_id: TENANT_ID,
    name: 'welcome_tr',
    media_type: 'audio/wav',
    language: 'tr-TR',
    storage_uri: '/sounds/tenants/acme/welcome_tr.wav',
    checksum: 'sha256:abc',
    status: 'active',
    created_at: now,
    updated_at: now,
    ...extra,
  };
}

const mockRepo = {
  findAllByTenant: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deactivate: vi.fn(),
} as unknown as PromptAssetRepository;

const service = new PromptAssetService(mockRepo);

beforeEach(() => vi.clearAllMocks());

describe('PromptAssetService', () => {
  it('lists prompts for the tenant', async () => {
    vi.mocked(mockRepo.findAllByTenant).mockResolvedValue([makePrompt()]);
    const prompts = await service.listByTenant(TENANT_ID);
    expect(prompts).toHaveLength(1);
  });

  it('throws PromptAssetNotFoundError when prompt does not exist', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null);
    await expect(service.getById(PROMPT_ID, TENANT_ID)).rejects.toThrow(PromptAssetNotFoundError);
  });

  it('updates prompt metadata', async () => {
    vi.mocked(mockRepo.update).mockResolvedValue(makePrompt({ name: 'menu_tr' }));
    const prompt = await service.update(PROMPT_ID, TENANT_ID, { name: 'menu_tr' });
    expect(prompt.name).toBe('menu_tr');
  });
});
