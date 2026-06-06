import type { QueueCallbacksRepository } from './queue-callbacks.repository.js';
import {
  isTerminalCallbackStatus,
  isValidCallbackTransition,
  type CreateQueueCallbackInput,
  type QueueCallback,
  type UpdateQueueCallbackInput,
} from './queue-callbacks.types.js';

export class QueueCallbackNotFoundError extends Error {
  constructor(id: string) {
    super(`Queue callback not found: ${id}`);
    this.name = 'QueueCallbackNotFoundError';
  }
}

export class QueueCallbackValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QueueCallbackValidationError';
  }
}

export class QueueCallbackTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Cannot transition callback from '${from}' to '${to}'`);
    this.name = 'QueueCallbackTransitionError';
  }
}

export class QueueCallbacksService {
  constructor(private readonly repo: QueueCallbacksRepository) {}

  listByTenant(tenantId: string): Promise<QueueCallback[]> {
    return this.repo.findAllByTenant(tenantId);
  }

  listByQueue(queueId: string, tenantId: string): Promise<QueueCallback[]> {
    return this.repo.findByQueue(queueId, tenantId);
  }

  async getById(id: string, tenantId: string): Promise<QueueCallback> {
    const cb = await this.repo.findById(id, tenantId);
    if (!cb) throw new QueueCallbackNotFoundError(id);
    return cb;
  }

  async create(queueId: string, input: CreateQueueCallbackInput): Promise<QueueCallback> {
    if (!input.caller_phone.trim()) {
      throw new QueueCallbackValidationError('caller_phone must not be empty');
    }
    if (input.max_retries !== undefined && (input.max_retries < 0 || input.max_retries > 10)) {
      throw new QueueCallbackValidationError('max_retries must be between 0 and 10');
    }

    const queueExists = await this.repo.findQueueExists(queueId, input.tenant_id);
    if (!queueExists) {
      throw new QueueCallbackValidationError(`Queue not found: ${queueId}`);
    }

    return this.repo.create({ ...input, queue_id: queueId });
  }

  async update(id: string, tenantId: string, input: UpdateQueueCallbackInput): Promise<QueueCallback> {
    const cb = await this.repo.findById(id, tenantId);
    if (!cb) throw new QueueCallbackNotFoundError(id);

    if (input.status !== undefined && input.status !== cb.status) {
      if (isTerminalCallbackStatus(cb.status)) {
        throw new QueueCallbackTransitionError(cb.status, input.status);
      }
      if (!isValidCallbackTransition(cb.status, input.status)) {
        throw new QueueCallbackTransitionError(cb.status, input.status);
      }
      if (input.status === 'pending' && cb.retry_count >= cb.max_retries) {
        throw new QueueCallbackValidationError('Max retries reached for this callback');
      }
    }

    const updated = await this.repo.update(id, tenantId, input);
    if (!updated) throw new QueueCallbackNotFoundError(id);
    return updated;
  }

  async cancel(id: string, tenantId: string): Promise<QueueCallback> {
    const cb = await this.repo.findById(id, tenantId);
    if (!cb) throw new QueueCallbackNotFoundError(id);

    if (isTerminalCallbackStatus(cb.status)) {
      return cb;
    }
    if (!isValidCallbackTransition(cb.status, 'cancelled')) {
      throw new QueueCallbackTransitionError(cb.status, 'cancelled');
    }

    const updated = await this.repo.update(id, tenantId, { status: 'cancelled' });
    if (!updated) throw new QueueCallbackNotFoundError(id);
    return updated;
  }
}
