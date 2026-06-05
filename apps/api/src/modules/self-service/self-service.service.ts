import { randomBytes } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { encryptSipPassword } from '../../crypto/sip-secret.js';
import type { SelfServiceRepository } from './self-service.repository.js';
import type {
  ExtensionSelfServiceState,
  ResetSipCredentialResult,
  SelfServiceCallEvent,
  SelfServiceDeviceRegistration,
  SelfServicePolicy,
  SelfServiceVoicemailMessage,
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

export class SelfServiceVoicemailNotFoundError extends Error {
  constructor(id: string) {
    super(`Voicemail message not found: ${id}`);
    this.name = 'SelfServiceVoicemailNotFoundError';
  }
}

export class SelfServiceVoicemailPlaybackPathError extends Error {
  constructor() {
    super('Voicemail media is not available through the configured storage root');
    this.name = 'SelfServiceVoicemailPlaybackPathError';
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
  device_view: true,
  sip_credential_reset: false,
};

export class SelfServiceService {
  constructor(
    private readonly repo: SelfServiceRepository,
    private readonly recordingStorageRoot = resolve('recordings'),
  ) {}

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

  async listVoicemailMessages(
    userId: string,
    tenantId: string,
    options: { unreadOnly: boolean; limit: number },
  ): Promise<SelfServiceVoicemailMessage[]> {
    const policy = await this.getPolicy(tenantId);
    if (!policy.voicemail_view) throw new SelfServiceCapabilityError('voicemail_view');

    const extension = await this.getMyExtension(userId, tenantId);
    const mailboxId = await this.repo.findVoicemailBoxIdByExtensionNumber(tenantId, extension.extension_number);
    if (!mailboxId) return [];
    return this.repo.listVoicemailMessagesByMailbox(tenantId, mailboxId, options);
  }

  async markVoicemailRead(
    userId: string,
    tenantId: string,
    messageId: string,
  ): Promise<SelfServiceVoicemailMessage> {
    const policy = await this.getPolicy(tenantId);
    if (!policy.voicemail_view) throw new SelfServiceCapabilityError('voicemail_view');

    const mailboxId = await this.requireOwnedVoicemailBox(userId, tenantId);
    const message = await this.repo.markVoicemailReadForMailbox(messageId, tenantId, mailboxId);
    if (!message) throw new SelfServiceVoicemailNotFoundError(messageId);
    return message;
  }

  async deleteVoicemailMessage(userId: string, tenantId: string, messageId: string): Promise<void> {
    const policy = await this.getPolicy(tenantId);
    if (!policy.voicemail_view) throw new SelfServiceCapabilityError('voicemail_view');

    const mailboxId = await this.requireOwnedVoicemailBox(userId, tenantId);
    const deleted = await this.repo.softDeleteVoicemailForMailbox(messageId, tenantId, mailboxId);
    if (!deleted) throw new SelfServiceVoicemailNotFoundError(messageId);
  }

  async getVoicemailPlaybackPath(
    userId: string,
    tenantId: string,
    messageId: string,
  ): Promise<{ message: SelfServiceVoicemailMessage; file_path: string }> {
    const policy = await this.getPolicy(tenantId);
    if (!policy.voicemail_view) throw new SelfServiceCapabilityError('voicemail_view');

    const mailboxId = await this.requireOwnedVoicemailBox(userId, tenantId);
    const message = await this.repo.findVoicemailMessageForMailbox(messageId, tenantId, mailboxId);
    if (!message) throw new SelfServiceVoicemailNotFoundError(messageId);

    const root = resolve(this.recordingStorageRoot);
    const candidate = resolve(root, message.storage_path);
    if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) {
      throw new SelfServiceVoicemailPlaybackPathError();
    }

    return { message, file_path: candidate };
  }

  async listCallHistory(userId: string, tenantId: string): Promise<SelfServiceCallEvent[]> {
    const policy = await this.getPolicy(tenantId);
    if (!policy.call_history_view) throw new SelfServiceCapabilityError('call_history_view');

    const extension = await this.getMyExtension(userId, tenantId);
    return this.repo.listCallHistoryByExtensionNumber(tenantId, extension.extension_number);
  }

  async listDevices(userId: string, tenantId: string): Promise<SelfServiceDeviceRegistration[]> {
    const policy = await this.getPolicy(tenantId);
    if (!policy.device_view) throw new SelfServiceCapabilityError('device_view');

    const extension = await this.getMyExtension(userId, tenantId);
    return this.repo.listDeviceRegistrationsByExtensionNumber(tenantId, extension.extension_number);
  }

  async resetSipCredential(userId: string, tenantId: string): Promise<ResetSipCredentialResult> {
    const policy = await this.getPolicy(tenantId);
    if (!policy.sip_credential_reset) throw new SelfServiceCapabilityError('sip_credential_reset');

    const extension = await this.getMyExtension(userId, tenantId);
    const sipPassword = generateSipCredential();
    const encrypted = encryptSipPassword(sipPassword);
    const updated = await this.repo.updateSipCredential(extension.id, tenantId, {
      sip_password_ciphertext: encrypted.ciphertext,
      sip_password_key_id: encrypted.keyId,
    });
    if (!updated) throw new SelfServiceExtensionNotFoundError();
    return { ...updated, sip_password: sipPassword };
  }

  private async requireOwnedVoicemailBox(userId: string, tenantId: string): Promise<string> {
    const extension = await this.getMyExtension(userId, tenantId);
    const mailboxId = await this.repo.findVoicemailBoxIdByExtensionNumber(tenantId, extension.extension_number);
    if (!mailboxId) throw new SelfServiceExtensionNotFoundError();
    return mailboxId;
  }
}

function generateSipCredential(): string {
  return `mcai-${randomBytes(12).toString('base64url')}`;
}
