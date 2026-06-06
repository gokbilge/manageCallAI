import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CampaignsRepository } from './campaigns.repository.js';
import type { Campaign, CampaignAssignment, CampaignContact } from './campaigns.types.js';
import {
  CampaignAgentNotFoundError,
  CampaignContactNotFoundError,
  CampaignNotFoundError,
  CampaignValidationError,
  CampaignsService,
} from './campaigns.service.js';

const TENANT = 'tenant-1';
const CAMPAIGN_ID = 'campaign-1';

const baseCampaign: Campaign = {
  id: CAMPAIGN_ID,
  tenant_id: TENANT,
  name: 'Summer Outreach',
  description: null,
  campaign_type: 'outbound_preview',
  status: 'draft',
  outbound_route_id: null,
  max_concurrent_calls: 1,
  schedule_start_time: null,
  schedule_end_time: null,
  schedule_timezone: 'UTC',
  started_at: null,
  completed_at: null,
  created_at: new Date(),
  updated_at: new Date(),
};

const baseContact: CampaignContact = {
  id: 'contact-1',
  tenant_id: TENANT,
  campaign_id: CAMPAIGN_ID,
  phone_number: '+15551234567',
  display_name: 'Alice',
  context: {},
  dial_state: 'pending',
  attempt_count: 0,
  last_attempted_at: null,
  created_at: new Date(),
};

const baseAssignment: CampaignAssignment = {
  id: 'assign-1',
  tenant_id: TENANT,
  campaign_id: CAMPAIGN_ID,
  agent_profile_id: 'agent-1',
  assigned_at: new Date(),
};

function makeRepo(overrides: Partial<CampaignsRepository> = {}): CampaignsRepository {
  return {
    findAllByTenant: vi.fn().mockResolvedValue([baseCampaign]),
    findById: vi.fn().mockResolvedValue(baseCampaign),
    create: vi.fn().mockResolvedValue(baseCampaign),
    update: vi.fn().mockResolvedValue(baseCampaign),
    setStatus: vi.fn().mockResolvedValue({ ...baseCampaign, status: 'active' }),
    findContacts: vi.fn().mockResolvedValue([baseContact]),
    addContact: vi.fn().mockResolvedValue(baseContact),
    removeContact: vi.fn().mockResolvedValue(true),
    findAssignments: vi.fn().mockResolvedValue([baseAssignment]),
    assignAgent: vi.fn().mockResolvedValue(baseAssignment),
    removeAgent: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as unknown as CampaignsRepository;
}

describe('CampaignsService', () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: CampaignsService;

  beforeEach(() => {
    repo = makeRepo();
    service = new CampaignsService(repo);
  });

  it('creates a campaign with defaults', async () => {
    await service.create({ tenant_id: TENANT, name: 'Test Campaign' });
    expect(vi.mocked(repo.create)).toHaveBeenCalledWith(expect.objectContaining({ name: 'Test Campaign' }));
  });

  it('rejects invalid max_concurrent_calls', async () => {
    await expect(service.create({ tenant_id: TENANT, name: 'X', max_concurrent_calls: 0 }))
      .rejects.toBeInstanceOf(CampaignValidationError);
    await expect(service.create({ tenant_id: TENANT, name: 'X', max_concurrent_calls: 51 }))
      .rejects.toBeInstanceOf(CampaignValidationError);
  });

  it('rejects mismatched schedule times', async () => {
    await expect(service.create({ tenant_id: TENANT, name: 'X', schedule_start_time: '09:00' }))
      .rejects.toBeInstanceOf(CampaignValidationError);
  });

  it('throws CampaignNotFoundError when missing', async () => {
    repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
    service = new CampaignsService(repo);
    await expect(service.getById('missing', TENANT)).rejects.toBeInstanceOf(CampaignNotFoundError);
  });

  it('allows valid transition: draft → active', async () => {
    const result = await service.transition(CAMPAIGN_ID, TENANT, 'active');
    expect(result.status).toBe('active');
    expect(vi.mocked(repo.setStatus)).toHaveBeenCalledWith(CAMPAIGN_ID, TENANT, 'active', 'started_at');
  });

  it('rejects invalid transition: draft → paused', async () => {
    await expect(service.transition(CAMPAIGN_ID, TENANT, 'paused'))
      .rejects.toBeInstanceOf(CampaignValidationError);
  });

  it('rejects transition from completed campaign', async () => {
    repo = makeRepo({ findById: vi.fn().mockResolvedValue({ ...baseCampaign, status: 'completed' }) });
    service = new CampaignsService(repo);
    await expect(service.transition(CAMPAIGN_ID, TENANT, 'active'))
      .rejects.toBeInstanceOf(CampaignValidationError);
  });

  it('rejects adding contacts to cancelled campaign', async () => {
    repo = makeRepo({ findById: vi.fn().mockResolvedValue({ ...baseCampaign, status: 'cancelled' }) });
    service = new CampaignsService(repo);
    await expect(service.addContact(CAMPAIGN_ID, TENANT, { phone_number: '+1234' }))
      .rejects.toBeInstanceOf(CampaignValidationError);
  });

  it('throws CampaignContactNotFoundError when removing non-existent contact', async () => {
    repo = makeRepo({ removeContact: vi.fn().mockResolvedValue(false) });
    service = new CampaignsService(repo);
    await expect(service.removeContact(CAMPAIGN_ID, 'bad-contact', TENANT))
      .rejects.toBeInstanceOf(CampaignContactNotFoundError);
  });

  it('throws CampaignAgentNotFoundError when removing non-existent agent', async () => {
    repo = makeRepo({ removeAgent: vi.fn().mockResolvedValue(false) });
    service = new CampaignsService(repo);
    await expect(service.removeAgent(CAMPAIGN_ID, 'bad-agent', TENANT))
      .rejects.toBeInstanceOf(CampaignAgentNotFoundError);
  });
});
