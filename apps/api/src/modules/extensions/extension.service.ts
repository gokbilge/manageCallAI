import type { ExtensionRepository } from './extension.repository.js';
import type { CreateExtensionInput, Extension, UpdateExtensionInput } from './extension.types.js';

export class ExtensionNotFoundError extends Error {
  constructor(id: string) {
    super(`Extension not found: ${id}`);
    this.name = 'ExtensionNotFoundError';
  }
}

export class ExtensionService {
  constructor(private readonly repo: ExtensionRepository) {}

  listByTenant(tenantId: string): Promise<Extension[]> {
    return this.repo.findAllByTenant(tenantId);
  }

  async getById(id: string, tenantId: string): Promise<Extension> {
    const ext = await this.repo.findById(id, tenantId);
    if (!ext) throw new ExtensionNotFoundError(id);
    return ext;
  }

  create(input: CreateExtensionInput): Promise<Extension> {
    return this.repo.create(input);
  }

  async update(id: string, tenantId: string, input: UpdateExtensionInput): Promise<Extension> {
    const ext = await this.repo.update(id, tenantId, input);
    if (!ext) throw new ExtensionNotFoundError(id);
    return ext;
  }

  async deactivate(id: string, tenantId: string): Promise<Extension> {
    const ext = await this.repo.deactivate(id, tenantId);
    if (!ext) throw new ExtensionNotFoundError(id);
    return ext;
  }
}
