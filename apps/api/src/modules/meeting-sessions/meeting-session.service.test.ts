import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MeetingSessionService,
  MeetingSessionNotFoundError,
  MeetingChannelAccountInvalidError,
} from './meeting-session.service.js';
import type { MeetingSessionRepository } from './meeting-session.repository.js';
import type { MeetingSession } from './meeting-session.types.js';

const TENANT = 'tenant-1';
const ACCOUNT_ID = 'acct-1';

const baseSession: MeetingSession = {
  id: 'sess-1',
  tenant_id: TENANT,
  channel_account_id: ACCOUNT_ID,
  meeting_code: 'abc-123',
  meeting_url: 'https://meet.example.com/abc-123',
  status: 'scheduled',
  participant_count: 0,
  recording_reference: null,
  transcript_reference: null,
  provider_metadata: {},
  started_at: null,
  ended_at: null,
  created_at: new Date(),
  updated_at: new Date(),
};

function makeRepo(overrides: Partial<MeetingSessionRepository> = {}): MeetingSessionRepository {
  return {
    create: vi.fn().mockResolvedValue(baseSession),
    findById: vi.fn().mockResolvedValue(baseSession),
    findByTenant: vi.fn().mockResolvedValue([baseSession]),
    update: vi.fn().mockResolvedValue({ ...baseSession, status: 'active' }),
    findChannelAccount: vi.fn().mockResolvedValue({ id: ACCOUNT_ID }),
    ...overrides,
  } as unknown as MeetingSessionRepository;
}

describe('MeetingSessionService', () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: MeetingSessionService;

  beforeEach(() => {
    repo = makeRepo();
    service = new MeetingSessionService(repo);
  });

  it('creates a meeting session', async () => {
    const result = await service.create({
      tenant_id: TENANT,
      channel_account_id: ACCOUNT_ID,
      meeting_code: 'abc-123',
    });
    expect(result.id).toBe('sess-1');
  });

  it('throws MeetingChannelAccountInvalidError when channel account not found', async () => {
    repo = makeRepo({ findChannelAccount: vi.fn().mockResolvedValue(null) });
    service = new MeetingSessionService(repo);
    await expect(
      service.create({ tenant_id: TENANT, channel_account_id: 'bad' }),
    ).rejects.toBeInstanceOf(MeetingChannelAccountInvalidError);
  });

  it('getById returns session', async () => {
    const result = await service.getById('sess-1', TENANT);
    expect(result.meeting_code).toBe('abc-123');
  });

  it('getById throws MeetingSessionNotFoundError when missing', async () => {
    repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
    service = new MeetingSessionService(repo);
    await expect(service.getById('missing', TENANT)).rejects.toBeInstanceOf(MeetingSessionNotFoundError);
  });

  it('listByTenant returns sessions', async () => {
    const result = await service.listByTenant(TENANT);
    expect(result).toHaveLength(1);
  });

  it('update transitions status', async () => {
    const result = await service.update('sess-1', TENANT, { status: 'active' });
    expect(result.status).toBe('active');
  });

  it('update throws MeetingSessionNotFoundError when not found', async () => {
    repo = makeRepo({ update: vi.fn().mockResolvedValue(null) });
    service = new MeetingSessionService(repo);
    await expect(service.update('missing', TENANT, { status: 'active' })).rejects.toBeInstanceOf(MeetingSessionNotFoundError);
  });
});
