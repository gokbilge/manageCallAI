import type { PromptAssetRepository } from './prompt-asset.repository.js';
import type {
  CreatePromptAssetInput,
  PromptAsset,
  UpdatePromptAssetInput,
} from './prompt-asset.types.js';

export class PromptAssetNotFoundError extends Error {
  constructor(id: string) {
    super(`Prompt asset not found: ${id}`);
    this.name = 'PromptAssetNotFoundError';
  }
}

export class PromptAssetService {
  constructor(private readonly repo: PromptAssetRepository) {}

  listByTenant(tenantId: string): Promise<PromptAsset[]> {
    return this.repo.findAllByTenant(tenantId);
  }

  async getById(id: string, tenantId: string): Promise<PromptAsset> {
    const prompt = await this.repo.findById(id, tenantId);
    if (!prompt) throw new PromptAssetNotFoundError(id);
    return prompt;
  }

  create(input: CreatePromptAssetInput): Promise<PromptAsset> {
    return this.repo.create(input);
  }

  async update(id: string, tenantId: string, input: UpdatePromptAssetInput): Promise<PromptAsset> {
    const prompt = await this.repo.update(id, tenantId, input);
    if (!prompt) throw new PromptAssetNotFoundError(id);
    return prompt;
  }

  async deactivate(id: string, tenantId: string): Promise<PromptAsset> {
    const prompt = await this.repo.deactivate(id, tenantId);
    if (!prompt) throw new PromptAssetNotFoundError(id);
    return prompt;
  }
}
