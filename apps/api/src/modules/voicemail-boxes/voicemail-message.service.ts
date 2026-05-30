import {
  assertActiveResource,
  assertTenantScope,
  ResourceInactiveError,
  TenantScopeError,
} from '../domain-assertions.js';
import type { VoicemailMessageRepository } from './voicemail-message.repository.js';
import type { CreateVoicemailMessageInput, VoicemailMessage } from './voicemail-message.types.js';

export class VoicemailMessageNotFoundError extends Error {
  constructor(id: string) {
    super(`Voicemail message not found: ${id}`);
    this.name = 'VoicemailMessageNotFoundError';
  }
}

export class VoicemailMailboxNotFoundError extends Error {
  constructor(id: string) {
    super(`Voicemail mailbox not found: ${id}`);
    this.name = 'VoicemailMailboxNotFoundError';
  }
}

export { ResourceInactiveError, TenantScopeError };

export class VoicemailMessageService {
  constructor(private readonly repo: VoicemailMessageRepository) {}

  async ingest(input: CreateVoicemailMessageInput): Promise<VoicemailMessage> {
    const mailbox = await this.repo.findMailboxRuntimeRef(input.voicemail_box_id);
    if (!mailbox) {
      throw new VoicemailMailboxNotFoundError(input.voicemail_box_id);
    }
    assertTenantScope(mailbox.tenant_id, input.tenant_id, 'Voicemail mailbox tenant does not match message tenant_id');
    assertActiveResource(mailbox, 'Voicemail mailbox', input.voicemail_box_id);
    return this.repo.create(input);
  }

  listByMailbox(
    tenantId: string,
    boxId: string,
    options: { unreadOnly: boolean; limit: number },
  ): Promise<VoicemailMessage[]> {
    return this.repo.listByMailbox(tenantId, boxId, options);
  }

  async markRead(id: string, tenantId: string): Promise<VoicemailMessage> {
    const message = await this.repo.markRead(id, tenantId);
    if (!message) {
      throw new VoicemailMessageNotFoundError(id);
    }
    return message;
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const deleted = await this.repo.softDelete(id, tenantId);
    if (!deleted) {
      throw new VoicemailMessageNotFoundError(id);
    }
  }
}
