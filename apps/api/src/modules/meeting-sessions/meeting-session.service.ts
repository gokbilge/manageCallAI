import type { MeetingSessionRepository } from './meeting-session.repository.js';
import type { CreateMeetingSessionInput, MeetingSession, UpdateMeetingSessionInput } from './meeting-session.types.js';

export class MeetingSessionNotFoundError extends Error {
  constructor(id: string) { super(`Meeting session not found: ${id}`); this.name = 'MeetingSessionNotFoundError'; }
}

export class MeetingChannelAccountInvalidError extends Error {
  constructor(id: string) { super(`Channel account not found or inactive: ${id}`); this.name = 'MeetingChannelAccountInvalidError'; }
}

export class MeetingSessionService {
  constructor(private readonly repo: MeetingSessionRepository) {}

  async create(input: CreateMeetingSessionInput): Promise<MeetingSession> {
    const account = await this.repo.findChannelAccount(input.tenant_id, input.channel_account_id);
    if (!account) throw new MeetingChannelAccountInvalidError(input.channel_account_id);
    return this.repo.create(input);
  }

  async getById(id: string, tenantId: string): Promise<MeetingSession> {
    const session = await this.repo.findById(id, tenantId);
    if (!session) throw new MeetingSessionNotFoundError(id);
    return session;
  }

  async listByTenant(tenantId: string): Promise<MeetingSession[]> {
    return this.repo.findByTenant(tenantId);
  }

  async update(id: string, tenantId: string, input: UpdateMeetingSessionInput): Promise<MeetingSession> {
    const session = await this.repo.update(id, tenantId, input);
    if (!session) throw new MeetingSessionNotFoundError(id);
    return session;
  }
}
