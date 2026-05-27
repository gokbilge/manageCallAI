import { encryptSipPassword } from '../../crypto/sip-secret.js';
import type { SipTrunkRepository } from './sip-trunk.repository.js';
import type {
  CreateSipTrunkInput,
  CreateSipTrunkRepoInput,
  SipTrunk,
  UpdateSipTrunkInput,
  UpdateSipTrunkRepoInput,
} from './sip-trunk.types.js';

export class SipTrunkNotFoundError extends Error {
  constructor(id: string) {
    super(`SIP trunk not found: ${id}`);
    this.name = 'SipTrunkNotFoundError';
  }
}

export class SipTrunkService {
  constructor(private readonly repo: SipTrunkRepository) {}

  listByTenant(tenantId: string): Promise<SipTrunk[]> {
    return this.repo.findAllByTenant(tenantId);
  }

  async getById(id: string, tenantId: string): Promise<SipTrunk> {
    const trunk = await this.repo.findById(id, tenantId);
    if (!trunk) {
      throw new SipTrunkNotFoundError(id);
    }
    return trunk;
  }

  create(input: CreateSipTrunkInput): Promise<SipTrunk> {
    const { auth_password, ...rest } = input;
    const { ciphertext, keyId } = encryptSipPassword(auth_password);
    const repoInput: CreateSipTrunkRepoInput = {
      ...rest,
      auth_password_ciphertext: ciphertext,
      auth_password_key_id: keyId,
    };
    return this.repo.create(repoInput);
  }

  async update(id: string, tenantId: string, input: UpdateSipTrunkInput): Promise<SipTrunk> {
    const { auth_password, ...rest } = input;
    const repoInput: UpdateSipTrunkRepoInput = { ...rest };
    if (auth_password !== undefined) {
      const { ciphertext, keyId } = encryptSipPassword(auth_password);
      repoInput.auth_password_ciphertext = ciphertext;
      repoInput.auth_password_key_id = keyId;
    }
    const trunk = await this.repo.update(id, tenantId, repoInput);
    if (!trunk) {
      throw new SipTrunkNotFoundError(id);
    }
    return trunk;
  }

  async deactivate(id: string, tenantId: string): Promise<SipTrunk> {
    const trunk = await this.repo.deactivate(id, tenantId);
    if (!trunk) {
      throw new SipTrunkNotFoundError(id);
    }
    return trunk;
  }
}
