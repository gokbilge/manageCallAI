import type { AgentWorkspaceRepository } from './agent-workspace.repository.js';
import {
  isValidTransition,
  type AgentAvailability,
  type AgentProfile,
  type AgentProfileWithAvailability,
  type CreateAgentProfileInput,
  type SetAvailabilityInput,
  type UpdateAgentProfileInput,
} from './agent-workspace.types.js';

export class AgentNotFoundError extends Error {
  constructor(id: string) {
    super(`Agent profile not found: ${id}`);
    this.name = 'AgentNotFoundError';
  }
}

export class AgentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentValidationError';
  }
}

export class AgentAvailabilityTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Invalid availability transition: ${from} → ${to}`);
    this.name = 'AgentAvailabilityTransitionError';
  }
}

export class AgentWorkspaceService {
  constructor(private readonly repo: AgentWorkspaceRepository) {}

  listByTenant(tenantId: string): Promise<AgentProfileWithAvailability[]> {
    return this.repo.findAllByTenant(tenantId);
  }

  async getById(id: string, tenantId: string): Promise<AgentProfileWithAvailability> {
    const agent = await this.repo.findById(id, tenantId);
    if (!agent) throw new AgentNotFoundError(id);
    return agent;
  }

  async getWorkspaceForUser(userId: string, tenantId: string): Promise<AgentProfileWithAvailability> {
    const agent = await this.repo.findByUserId(userId, tenantId);
    if (!agent) throw new AgentNotFoundError(userId);
    return agent;
  }

  async create(input: CreateAgentProfileInput): Promise<AgentProfileWithAvailability> {
    if (input.max_concurrent_calls !== undefined) {
      if (!Number.isInteger(input.max_concurrent_calls) || input.max_concurrent_calls < 1 || input.max_concurrent_calls > 10) {
        throw new AgentValidationError('max_concurrent_calls must be an integer between 1 and 10');
      }
    }
    return this.repo.create(input);
  }

  async update(id: string, tenantId: string, input: UpdateAgentProfileInput): Promise<AgentProfile> {
    if (input.max_concurrent_calls !== undefined) {
      if (!Number.isInteger(input.max_concurrent_calls) || input.max_concurrent_calls < 1 || input.max_concurrent_calls > 10) {
        throw new AgentValidationError('max_concurrent_calls must be an integer between 1 and 10');
      }
    }
    const agent = await this.repo.update(id, tenantId, input);
    if (!agent) throw new AgentNotFoundError(id);
    return agent;
  }

  async deactivate(id: string, tenantId: string): Promise<AgentProfile> {
    const agent = await this.repo.deactivate(id, tenantId);
    if (!agent) throw new AgentNotFoundError(id);
    return agent;
  }

  async setAvailability(
    agentProfileId: string,
    tenantId: string,
    input: SetAvailabilityInput,
  ): Promise<AgentAvailability> {
    const current = await this.repo.getAvailability(agentProfileId, tenantId);
    const currentState = current?.state ?? 'offline';
    if (!isValidTransition(currentState, input.state)) {
      throw new AgentAvailabilityTransitionError(currentState, input.state);
    }
    return this.repo.upsertAvailability(agentProfileId, tenantId, input);
  }

  async setAvailabilityForUser(
    userId: string,
    tenantId: string,
    input: SetAvailabilityInput,
  ): Promise<AgentAvailability> {
    const agent = await this.repo.findByUserId(userId, tenantId);
    if (!agent) throw new AgentNotFoundError(userId);
    return this.setAvailability(agent.id, tenantId, input);
  }

  listAvailableForQueue(queueId: string, tenantId: string): Promise<AgentProfileWithAvailability[]> {
    return this.repo.findAvailableByQueue(queueId, tenantId);
  }
}
