import { encryptSipPassword } from '../../crypto/sip-secret.js';
import type { ExtensionRepository } from './extension.repository.js';
import type {
  CreateExtensionInput,
  Extension,
  UpdateExtensionInput,
  UpdateExtensionRepoInput,
} from './extension.types.js';

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
    const { sip_password, ...rest } = input;
    const { ciphertext, keyId } = encryptSipPassword(sip_password);
    return this.repo.create({
      ...rest,
      sip_password_ciphertext: ciphertext,
      sip_password_key_id: keyId,
    });
  }

  async update(id: string, tenantId: string, input: UpdateExtensionInput): Promise<Extension> {
    const { sip_password, ...rest } = input;
    const repoInput: UpdateExtensionRepoInput = { ...rest };
    if (sip_password !== undefined) {
      const { ciphertext, keyId } = encryptSipPassword(sip_password);
      repoInput.sip_password_ciphertext = ciphertext;
      repoInput.sip_password_key_id = keyId;
    }
    const ext = await this.repo.update(id, tenantId, repoInput);
    if (!ext) throw new ExtensionNotFoundError(id);
    return ext;
  }

  async deactivate(id: string, tenantId: string): Promise<Extension> {
    const ext = await this.repo.deactivate(id, tenantId);
    if (!ext) throw new ExtensionNotFoundError(id);
    return ext;
  }
}
