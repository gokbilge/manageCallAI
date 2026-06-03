import type { SelfServiceRepository } from './self-service.repository.js';
import type {
  ExtensionSelfServiceState,
  SelfServicePolicy,
  UpdateSelfServicePolicyInput,
} from './self-service.types.js';

const CAPABILITY_DISABLED_CODE = 'SELF_SERVICE_CAPABILITY_DISABLED';

export class SelfServiceCapabilityError extends Error {
  readonly code = CAPABILITY_DISABLED_CODE;
  constructor(feature: string) {
    super(`Self-service capability disabled by tenant policy: ${feature}`);
    this.name = 'SelfServiceCapabilityError';
  }
}

export class SelfServiceExtensionNotFoundError extends Error {
  constructor() {
    super('No active extension found for this user account');
    this.name = 'SelfServiceExtensionNotFoundError';
  }
}

// Default policy when no row exists for a tenant.
const DEFAULT_POLICY: Omit<SelfServicePolicy, 'id' | 'tenant_id' | 'created_at' | 'updated_at'> = {
  voicemail_view: true,
  voicemail_pin_change: true,
  dnd_manage: true,
  call_forward_manage: false,
  call_forward_set_target: false,
  call_history_view: true,
};

export class SelfServiceService {
  constructor(private readonly repo: SelfServiceRepository) {}

  async getPolicy(tenantId: string): Promise<SelfServicePolicy> {
    const policy = await this.repo.findPolicy(tenantId);
    if (policy) return policy;
    // Return default policy without persisting
    return {
      id: '',
      tenant_id: tenantId,
      ...DEFAULT_POLICY,
      created_at: new Date(),
      updated_at: new Date(),
    };
  }

  async updatePolicy(tenantId: string, input: UpdateSelfServicePolicyInput): Promise<SelfServicePolicy> {
    return this.repo.upsertPolicy(tenantId, input);
  }

  async getMyExtension(userId: string, tenantId: string): Promise<ExtensionSelfServiceState> {
    const ext = await this.repo.findExtensionByUserId(userId, tenantId);
    if (!ext) throw new SelfServiceExtensionNotFoundError();
    return ext;
  }

  async getDnd(userId: string, tenantId: string): Promise<{ dnd_enabled: boolean }> {
    const ext = await this.getMyExtension(userId, tenantId);
    return { dnd_enabled: ext.dnd_enabled };
  }

  async setDnd(userId: string, tenantId: string, enabled: boolean): Promise<ExtensionSelfServiceState> {
    const policy = await this.getPolicy(tenantId);
    if (!policy.dnd_manage) throw new SelfServiceCapabilityError('dnd_manage');

    const ext = await this.getMyExtension(userId, tenantId);
    const updated = await this.repo.setDnd(ext.id, tenantId, enabled);
    if (!updated) throw new SelfServiceExtensionNotFoundError();
    return updated;
  }

  async getCallForward(userId: string, tenantId: string): Promise<{ call_forward_enabled: boolean; call_forward_target: string | null }> {
    const policy = await this.getPolicy(tenantId);
    if (!policy.call_forward_manage) throw new SelfServiceCapabilityError('call_forward_manage');

    const ext = await this.getMyExtension(userId, tenantId);
    return { call_forward_enabled: ext.call_forward_enabled, call_forward_target: ext.call_forward_target };
  }

  async setCallForward(
    userId: string,
    tenantId: string,
    enabled: boolean,
    target?: string | null,
  ): Promise<ExtensionSelfServiceState> {
    const policy = await this.getPolicy(tenantId);
    if (!policy.call_forward_manage) throw new SelfServiceCapabilityError('call_forward_manage');
    if (target !== undefined && target !== null && !policy.call_forward_set_target) {
      throw new SelfServiceCapabilityError('call_forward_set_target');
    }

    const ext = await this.getMyExtension(userId, tenantId);
    const updated = await this.repo.setCallForward(ext.id, tenantId, enabled, target);
    if (!updated) throw new SelfServiceExtensionNotFoundError();
    return updated;
  }
}
