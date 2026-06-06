import type { SupervisorControlsRepository } from './supervisor-controls.repository.js';
import {
  isValidControlTransition,
  type CreateSupervisorControlInput,
  type SupervisorControl,
  type UpdateSupervisorControlInput,
} from './supervisor-controls.types.js';

export class SupervisorControlNotFoundError extends Error {
  constructor(id: string) {
    super(`Supervisor control not found: ${id}`);
    this.name = 'SupervisorControlNotFoundError';
  }
}

export class SupervisorControlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupervisorControlValidationError';
  }
}

export class SupervisorControlTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Cannot transition supervisor control from '${from}' to '${to}'`);
    this.name = 'SupervisorControlTransitionError';
  }
}

export class SupervisorControlsService {
  constructor(private readonly repo: SupervisorControlsRepository) {}

  listByTenant(tenantId: string): Promise<SupervisorControl[]> {
    return this.repo.findAllByTenant(tenantId);
  }

  async getById(id: string, tenantId: string): Promise<SupervisorControl> {
    const control = await this.repo.findById(id, tenantId);
    if (!control) throw new SupervisorControlNotFoundError(id);
    return control;
  }

  async create(input: CreateSupervisorControlInput): Promise<SupervisorControl> {
    if (!input.target_call_id.trim()) {
      throw new SupervisorControlValidationError('target_call_id must not be empty');
    }
    return this.repo.create(input);
  }

  async update(id: string, tenantId: string, input: UpdateSupervisorControlInput): Promise<SupervisorControl> {
    const control = await this.repo.findById(id, tenantId);
    if (!control) throw new SupervisorControlNotFoundError(id);

    if (input.status !== undefined && input.status !== control.status) {
      if (!isValidControlTransition(control.status, input.status)) {
        throw new SupervisorControlTransitionError(control.status, input.status);
      }
    }

    const updated = await this.repo.update(id, tenantId, input);
    if (!updated) throw new SupervisorControlNotFoundError(id);
    return updated;
  }

  async end(id: string, tenantId: string): Promise<SupervisorControl> {
    const control = await this.repo.findById(id, tenantId);
    if (!control) throw new SupervisorControlNotFoundError(id);

    if (control.status === 'ended') {
      return control;
    }
    if (!isValidControlTransition(control.status, 'ended')) {
      throw new SupervisorControlTransitionError(control.status, 'ended');
    }

    const updated = await this.repo.setStatus(id, tenantId, 'ended');
    if (!updated) throw new SupervisorControlNotFoundError(id);
    return updated;
  }
}
