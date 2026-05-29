import type { QueueRepository } from './queue.repository.js';
import type {
  AddQueueMemberInput,
  CreateQueueInput,
  Queue,
  QueueMember,
  QueueWithMembers,
  UpdateQueueInput,
} from './queue.types.js';

export class QueueNotFoundError extends Error {
  constructor(id: string) {
    super(`Queue not found: ${id}`);
    this.name = 'QueueNotFoundError';
  }
}

export class QueueMemberInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QueueMemberInvalidError';
  }
}

export class QueueMemberNotFoundError extends Error {
  constructor(queueId: string, extensionId: string) {
    super(`Queue member not found: queue=${queueId} extension=${extensionId}`);
    this.name = 'QueueMemberNotFoundError';
  }
}

export class QueueService {
  constructor(private readonly repo: QueueRepository) {}

  listByTenant(tenantId: string): Promise<Queue[]> {
    return this.repo.findAllByTenant(tenantId);
  }

  async getById(id: string, tenantId: string): Promise<QueueWithMembers> {
    const queue = await this.repo.findById(id, tenantId);
    if (!queue) throw new QueueNotFoundError(id);
    return queue;
  }

  create(input: CreateQueueInput): Promise<QueueWithMembers> {
    return this.repo.create(input);
  }

  async update(id: string, tenantId: string, input: UpdateQueueInput): Promise<Queue> {
    const queue = await this.repo.update(id, tenantId, input);
    if (!queue) throw new QueueNotFoundError(id);
    return queue;
  }

  async deactivate(id: string, tenantId: string): Promise<Queue> {
    const queue = await this.repo.deactivate(id, tenantId);
    if (!queue) throw new QueueNotFoundError(id);
    return queue;
  }

  async addMember(queueId: string, tenantId: string, input: AddQueueMemberInput): Promise<QueueMember> {
    const queue = await this.repo.findById(queueId, tenantId);
    if (!queue) throw new QueueNotFoundError(queueId);

    const extension = await this.repo.findActiveExtension(input.extension_id, tenantId);
    if (!extension) {
      throw new QueueMemberInvalidError(`Extension not found or inactive: ${input.extension_id}`);
    }

    return this.repo.addMember(queueId, tenantId, input);
  }

  async removeMember(queueId: string, extensionId: string, tenantId: string): Promise<void> {
    const queue = await this.repo.findById(queueId, tenantId);
    if (!queue) throw new QueueNotFoundError(queueId);

    const removed = await this.repo.removeMember(queueId, extensionId, tenantId);
    if (!removed) {
      throw new QueueMemberNotFoundError(queueId, extensionId);
    }
  }
}
