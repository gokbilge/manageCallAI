import { encryptSipPassword } from '../../crypto/sip-secret.js';
import type { SipTrunkRepository } from './sip-trunk.repository.js';
import type {
  CreateSipTrunkInput,
  CreateSipTrunkRepoInput,
  SipTrunk,
  UpdateSipTrunkInput,
  UpdateSipTrunkRepoInput,
} from './sip-trunk.types.js';
import type { RuntimeApplyService } from './runtime-apply.service.js';
import type { RuntimeApplyRequest } from './runtime-apply.types.js';

export class SipTrunkNotFoundError extends Error {
  constructor(id: string) {
    super(`SIP trunk not found: ${id}`);
    this.name = 'SipTrunkNotFoundError';
  }
}

export class SipTrunkService {
  constructor(
    private readonly repo: SipTrunkRepository,
    private readonly applyService?: RuntimeApplyService,
  ) {}

  listByTenant(tenantId: string): Promise<SipTrunk[]> {
    return this.repo.findAllByTenant(tenantId);
  }

  async getById(id: string, tenantId: string): Promise<SipTrunk> {
    const trunk = await this.repo.findById(id, tenantId);
    if (!trunk) throw new SipTrunkNotFoundError(id);
    return trunk;
  }

  async create(input: CreateSipTrunkInput & { actorId?: string }): Promise<{ trunk: SipTrunk; applyRequests: RuntimeApplyRequest[] }> {
    const { auth_password, actorId, ...rest } = input;
    const { ciphertext, keyId } = encryptSipPassword(auth_password);
    const repoInput: CreateSipTrunkRepoInput = {
      ...rest,
      auth_password_ciphertext: ciphertext,
      auth_password_key_id: keyId,
    };
    const trunk = await this.repo.create(repoInput);
    const applyRequests = await this.triggerApply(trunk.tenant_id, trunk.id, actorId ?? null);
    return { trunk, applyRequests };
  }

  async update(id: string, tenantId: string, input: UpdateSipTrunkInput & { actorId?: string }): Promise<{ trunk: SipTrunk; applyRequests: RuntimeApplyRequest[] }> {
    const { auth_password, actorId, ...rest } = input;
    const repoInput: UpdateSipTrunkRepoInput = { ...rest };
    if (auth_password !== undefined) {
      const { ciphertext, keyId } = encryptSipPassword(auth_password);
      repoInput.auth_password_ciphertext = ciphertext;
      repoInput.auth_password_key_id = keyId;
    }
    const trunk = await this.repo.update(id, tenantId, repoInput);
    if (!trunk) throw new SipTrunkNotFoundError(id);
    const applyRequests = await this.triggerApply(tenantId, trunk.id, actorId ?? null);
    return { trunk, applyRequests };
  }

  async deactivate(id: string, tenantId: string, actorId?: string): Promise<{ trunk: SipTrunk; applyRequests: RuntimeApplyRequest[] }> {
    const trunk = await this.repo.deactivate(id, tenantId);
    if (!trunk) throw new SipTrunkNotFoundError(id);
    const applyRequests = await this.triggerApply(tenantId, trunk.id, actorId ?? null);
    return { trunk, applyRequests };
  }

  private async triggerApply(tenantId: string, trunkId: string, actorId: string | null): Promise<RuntimeApplyRequest[]> {
    if (!this.applyService) return [];
    return this.applyService.createForTrunkChange({
      tenantId,
      trunkId,
      actorId,
      triggeredBy: 'user',
    });
  }
}
