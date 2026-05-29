import type { VoicemailBoxRepository } from './voicemail-box.repository.js';
import type {
  CreateVoicemailBoxInput,
  UpdateVoicemailBoxInput,
  VoicemailBox,
} from './voicemail-box.types.js';

export class VoicemailBoxNotFoundError extends Error {
  constructor(id: string) {
    super(`Voicemail box not found: ${id}`);
    this.name = 'VoicemailBoxNotFoundError';
  }
}

export class VoicemailBoxInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VoicemailBoxInputError';
  }
}

const MAILBOX_PATTERN = /^[0-9]{2,12}$/;

export class VoicemailBoxService {
  constructor(private readonly repo: VoicemailBoxRepository) {}

  listByTenant(tenantId: string): Promise<VoicemailBox[]> {
    return this.repo.findAllByTenant(tenantId);
  }

  async getById(id: string, tenantId: string): Promise<VoicemailBox> {
    const box = await this.repo.findById(id, tenantId);
    if (!box) throw new VoicemailBoxNotFoundError(id);
    return box;
  }

  async create(input: CreateVoicemailBoxInput): Promise<VoicemailBox> {
    this.assertMailboxNumber(input.mailbox_number);
    await this.assertGreetingPrompt(input.tenant_id, input.greeting_prompt_id ?? null);
    return this.repo.create(input);
  }

  async update(id: string, tenantId: string, input: UpdateVoicemailBoxInput): Promise<VoicemailBox> {
    if (input.mailbox_number !== undefined) {
      this.assertMailboxNumber(input.mailbox_number);
    }
    if ('greeting_prompt_id' in input) {
      await this.assertGreetingPrompt(tenantId, input.greeting_prompt_id ?? null);
    }
    const box = await this.repo.update(id, tenantId, input);
    if (!box) throw new VoicemailBoxNotFoundError(id);
    return box;
  }

  async deactivate(id: string, tenantId: string): Promise<VoicemailBox> {
    const box = await this.repo.deactivate(id, tenantId);
    if (!box) throw new VoicemailBoxNotFoundError(id);
    return box;
  }

  private assertMailboxNumber(mailboxNumber: string): void {
    if (!MAILBOX_PATTERN.test(mailboxNumber)) {
      throw new VoicemailBoxInputError('mailbox_number must contain 2-12 digits');
    }
  }

  private async assertGreetingPrompt(tenantId: string, promptId: string | null): Promise<void> {
    if (!promptId) return;
    const prompt = await this.repo.findActivePrompt(promptId, tenantId);
    if (!prompt) {
      throw new VoicemailBoxInputError(`Greeting prompt not found or inactive: ${promptId}`);
    }
  }
}
