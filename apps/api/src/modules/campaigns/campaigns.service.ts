import type { CampaignsRepository } from './campaigns.repository.js';
import type {
  AddCampaignContactInput,
  AssignCampaignAgentInput,
  Campaign,
  CampaignAssignment,
  CampaignContact,
  CreateCampaignInput,
  UpdateCampaignInput,
} from './campaigns.types.js';

export class CampaignNotFoundError extends Error {
  constructor(id: string) {
    super(`Campaign not found: ${id}`);
    this.name = 'CampaignNotFoundError';
  }
}

export class CampaignContactNotFoundError extends Error {
  constructor(id: string) {
    super(`Campaign contact not found: ${id}`);
    this.name = 'CampaignContactNotFoundError';
  }
}

export class CampaignAgentNotFoundError extends Error {
  constructor(agentId: string) {
    super(`Campaign agent assignment not found: ${agentId}`);
    this.name = 'CampaignAgentNotFoundError';
  }
}

export class CampaignValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CampaignValidationError';
  }
}

// Valid lifecycle transitions.
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['active', 'cancelled'],
  active: ['paused', 'completed', 'cancelled'],
  paused: ['active', 'cancelled'],
  completed: [],
  cancelled: [],
};

export class CampaignsService {
  constructor(private readonly repo: CampaignsRepository) {}

  listByTenant(tenantId: string): Promise<Campaign[]> {
    return this.repo.findAllByTenant(tenantId);
  }

  async getById(id: string, tenantId: string): Promise<Campaign> {
    const campaign = await this.repo.findById(id, tenantId);
    if (!campaign) throw new CampaignNotFoundError(id);
    return campaign;
  }

  async create(input: CreateCampaignInput): Promise<Campaign> {
    validateCampaignInput(input);
    return this.repo.create(input);
  }

  async update(id: string, tenantId: string, input: UpdateCampaignInput): Promise<Campaign> {
    const campaign = await this.repo.findById(id, tenantId);
    if (!campaign) throw new CampaignNotFoundError(id);
    if (campaign.status !== 'draft' && campaign.status !== 'paused') {
      throw new CampaignValidationError(`Campaign in status '${campaign.status}' cannot be updated`);
    }
    validateCampaignInput(input);
    const updated = await this.repo.update(id, tenantId, input);
    if (!updated) throw new CampaignNotFoundError(id);
    return updated;
  }

  async transition(id: string, tenantId: string, targetStatus: Campaign['status']): Promise<Campaign> {
    const campaign = await this.repo.findById(id, tenantId);
    if (!campaign) throw new CampaignNotFoundError(id);

    const valid = VALID_STATUS_TRANSITIONS[campaign.status] ?? [];
    if (!valid.includes(targetStatus)) {
      throw new CampaignValidationError(`Cannot transition campaign from '${campaign.status}' to '${targetStatus}'`);
    }

    const timestampField =
      targetStatus === 'active' && campaign.status === 'draft' ? 'started_at' :
      targetStatus === 'completed' ? 'completed_at' :
      undefined;

    const updated = await this.repo.setStatus(id, tenantId, targetStatus, timestampField);
    if (!updated) throw new CampaignNotFoundError(id);
    return updated;
  }

  // ── Contacts ──────────────────────────────────────────────────────────────

  async listContacts(campaignId: string, tenantId: string): Promise<CampaignContact[]> {
    await this.getById(campaignId, tenantId);
    return this.repo.findContacts(campaignId, tenantId);
  }

  async addContact(campaignId: string, tenantId: string, input: AddCampaignContactInput): Promise<CampaignContact> {
    const campaign = await this.repo.findById(campaignId, tenantId);
    if (!campaign) throw new CampaignNotFoundError(campaignId);
    if (campaign.status === 'completed' || campaign.status === 'cancelled') {
      throw new CampaignValidationError(`Cannot add contacts to a ${campaign.status} campaign`);
    }
    return this.repo.addContact(campaignId, tenantId, input);
  }

  async removeContact(campaignId: string, contactId: string, tenantId: string): Promise<void> {
    await this.getById(campaignId, tenantId);
    const removed = await this.repo.removeContact(campaignId, contactId, tenantId);
    if (!removed) throw new CampaignContactNotFoundError(contactId);
  }

  // ── Assignments ───────────────────────────────────────────────────────────

  async listAssignments(campaignId: string, tenantId: string): Promise<CampaignAssignment[]> {
    await this.getById(campaignId, tenantId);
    return this.repo.findAssignments(campaignId, tenantId);
  }

  async assignAgent(campaignId: string, tenantId: string, input: AssignCampaignAgentInput): Promise<CampaignAssignment> {
    const campaign = await this.repo.findById(campaignId, tenantId);
    if (!campaign) throw new CampaignNotFoundError(campaignId);
    if (campaign.status === 'completed' || campaign.status === 'cancelled') {
      throw new CampaignValidationError(`Cannot assign agents to a ${campaign.status} campaign`);
    }
    return this.repo.assignAgent(campaignId, tenantId, input);
  }

  async removeAgent(campaignId: string, agentProfileId: string, tenantId: string): Promise<void> {
    await this.getById(campaignId, tenantId);
    const removed = await this.repo.removeAgent(campaignId, agentProfileId, tenantId);
    if (!removed) throw new CampaignAgentNotFoundError(agentProfileId);
  }
}

function validateCampaignInput(input: CreateCampaignInput | UpdateCampaignInput): void {
  if (input.max_concurrent_calls !== undefined) {
    if (!Number.isInteger(input.max_concurrent_calls) || input.max_concurrent_calls < 1 || input.max_concurrent_calls > 50) {
      throw new CampaignValidationError('max_concurrent_calls must be an integer between 1 and 50');
    }
  }
  const hasStart = 'schedule_start_time' in input && input.schedule_start_time != null;
  const hasEnd = 'schedule_end_time' in input && input.schedule_end_time != null;
  if (hasStart !== hasEnd) {
    throw new CampaignValidationError('schedule_start_time and schedule_end_time must be set or cleared together');
  }
}
