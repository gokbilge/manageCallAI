import type { DispositionsRepository } from './dispositions.repository.js';
import type {
  CallDisposition,
  CallDispositionWithCode,
  CallNote,
  CreateDispositionCodeInput,
  CreateCallNoteInput,
  DispositionCode,
  RecordDispositionInput,
  UpdateCallNoteInput,
  UpdateDispositionCodeInput,
} from './dispositions.types.js';

export class DispositionNotFoundError extends Error {}
export class DispositionCodeNotFoundError extends Error {}
export class DispositionValidationError extends Error {}
export class CallNoteNotFoundError extends Error {}

export class DispositionsService {
  constructor(private readonly repo: DispositionsRepository) {}

  // ── Disposition codes ──────────────────────────────────────────────────────

  async listCodes(tenantId: string, queueId?: string | null): Promise<DispositionCode[]> {
    return this.repo.listCodes(tenantId, queueId);
  }

  async getCodeById(id: string, tenantId: string): Promise<DispositionCode> {
    const code = await this.repo.findCodeById(id, tenantId);
    if (!code) throw new DispositionCodeNotFoundError(`Disposition code ${id} not found`);
    return code;
  }

  async createCode(input: CreateDispositionCodeInput): Promise<DispositionCode> {
    if (await this.repo.codeExistsByCode(input.code, input.tenant_id)) {
      throw new DispositionValidationError(`Disposition code '${input.code}' already exists`);
    }
    return this.repo.createCode(input);
  }

  async updateCode(id: string, tenantId: string, input: UpdateDispositionCodeInput): Promise<DispositionCode> {
    if (input.label !== undefined && !input.label.trim()) {
      throw new DispositionValidationError('label must not be empty');
    }
    const updated = await this.repo.updateCode(id, tenantId, input);
    if (!updated) throw new DispositionCodeNotFoundError(`Disposition code ${id} not found`);
    return updated;
  }

  // ── Call dispositions ──────────────────────────────────────────────────────

  async getDispositionByCallId(callId: string, tenantId: string): Promise<CallDispositionWithCode | null> {
    return this.repo.findDispositionByCallId(callId, tenantId);
  }

  async listDispositionsByAgent(agentProfileId: string, tenantId: string): Promise<CallDispositionWithCode[]> {
    return this.repo.listDispositionsByAgent(agentProfileId, tenantId);
  }

  async recordDisposition(
    tenantId: string,
    input: RecordDispositionInput,
    recordedBy: string,
  ): Promise<CallDisposition> {
    const code = await this.repo.findCodeById(input.disposition_code_id, tenantId);
    if (!code) throw new DispositionCodeNotFoundError(`Disposition code ${input.disposition_code_id} not found`);
    if (!code.is_active) throw new DispositionValidationError('Disposition code is inactive');
    return this.repo.upsertDisposition(
      tenantId,
      input.call_id,
      input.disposition_code_id,
      input.agent_profile_id ?? null,
      recordedBy,
      input.note ?? null,
    );
  }

  // ── Call notes ─────────────────────────────────────────────────────────────

  async listNotesByCall(callId: string, tenantId: string): Promise<CallNote[]> {
    return this.repo.listNotesByCall(callId, tenantId);
  }

  async createNote(tenantId: string, authorUserId: string, input: CreateCallNoteInput): Promise<CallNote> {
    if (!input.content.trim()) throw new DispositionValidationError('Note content must not be empty');
    return this.repo.createNote(tenantId, input.call_id, authorUserId, input.content);
  }

  async updateNote(id: string, tenantId: string, authorUserId: string, input: UpdateCallNoteInput): Promise<CallNote> {
    if (!input.content.trim()) throw new DispositionValidationError('Note content must not be empty');
    const updated = await this.repo.updateNote(id, tenantId, authorUserId, input.content);
    if (!updated) throw new CallNoteNotFoundError(`Note ${id} not found or not owned by caller`);
    return updated;
  }

  async deleteNote(id: string, tenantId: string, authorUserId: string): Promise<void> {
    const deleted = await this.repo.deleteNote(id, tenantId, authorUserId);
    if (!deleted) throw new CallNoteNotFoundError(`Note ${id} not found or not owned by caller`);
  }
}
