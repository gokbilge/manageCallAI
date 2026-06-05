import type { FeatureCodeRepository } from './feature-code.repository.js';
import type {
  CreateFeatureCodeInput,
  FeatureCode,
  FeatureCodeActionType,
  UpdateFeatureCodeInput,
} from './feature-code.types.js';
import { FEATURE_CODE_ACTION_TYPES } from './feature-code.types.js';
import { GLOBAL_EMERGENCY_NUMBERS } from '../shared/emergency-constants.js';

export class FeatureCodeNotFoundError extends Error {
  constructor(id: string) { super(`Feature code not found: ${id}`); this.name = 'FeatureCodeNotFoundError'; }
}

export class FeatureCodeConflictError extends Error {
  constructor(message: string) { super(message); this.name = 'FeatureCodeConflictError'; }
}

export class FeatureCodeStateError extends Error {
  constructor(message: string) { super(message); this.name = 'FeatureCodeStateError'; }
}

export class FeatureCodeService {
  constructor(private readonly repo: FeatureCodeRepository) {}

  async list(tenantId: string): Promise<FeatureCode[]> {
    return this.repo.findAllByTenant(tenantId);
  }

  async getById(id: string, tenantId: string): Promise<FeatureCode> {
    const fc = await this.repo.findById(id, tenantId);
    if (!fc) throw new FeatureCodeNotFoundError(id);
    return fc;
  }

  async create(input: CreateFeatureCodeInput): Promise<FeatureCode> {
    this.validateCode(input.code);
    const existing = await this.repo.findByCode(input.code, input.tenant_id);
    if (existing) {
      throw new FeatureCodeConflictError(
        `Feature code ${input.code} already exists for this tenant`,
      );
    }
    return this.repo.create(input);
  }

  async update(id: string, tenantId: string, input: UpdateFeatureCodeInput): Promise<FeatureCode> {
    const fc = await this.repo.findById(id, tenantId);
    if (!fc) throw new FeatureCodeNotFoundError(id);
    if (fc.status !== 'draft') {
      throw new FeatureCodeStateError(
        'Feature code can only be updated while in draft status. Disable it first to create a new draft.',
      );
    }
    const updated = await this.repo.update(id, tenantId, input);
    if (!updated) throw new FeatureCodeNotFoundError(id);
    return updated;
  }

  async publish(id: string, tenantId: string): Promise<FeatureCode> {
    const fc = await this.repo.findById(id, tenantId);
    if (!fc) throw new FeatureCodeNotFoundError(id);
    if (fc.status !== 'draft') {
      throw new FeatureCodeStateError(`Feature code is not in draft status: ${fc.status}`);
    }
    const published = await this.repo.publish(id, tenantId);
    if (!published) throw new FeatureCodeNotFoundError(id);
    return published;
  }

  async disable(id: string, tenantId: string): Promise<FeatureCode> {
    const fc = await this.repo.findById(id, tenantId);
    if (!fc) throw new FeatureCodeNotFoundError(id);
    if (fc.status !== 'active') {
      throw new FeatureCodeStateError(`Feature code is not active: ${fc.status}`);
    }
    const disabled = await this.repo.disable(id, tenantId);
    if (!disabled) throw new FeatureCodeNotFoundError(id);
    return disabled;
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const fc = await this.repo.findById(id, tenantId);
    if (!fc) throw new FeatureCodeNotFoundError(id);
    if (fc.status === 'active') {
      throw new FeatureCodeStateError('Cannot delete an active feature code. Disable it first.');
    }
    const deleted = await this.repo.delete(id, tenantId);
    if (!deleted) throw new FeatureCodeNotFoundError(id);
  }

  // Runtime: resolve the action for an inbound DTMF code.
  async resolveForRuntime(code: string, tenantId: string): Promise<FeatureCode | null> {
    const fc = await this.repo.findByCode(code, tenantId);
    if (!fc || fc.status !== 'active') return null;
    return fc;
  }

  // Validates whether a draft feature code is ready to publish.
  async validate(id: string, tenantId: string): Promise<{ valid: boolean; errors: string[] }> {
    const fc = await this.repo.findById(id, tenantId);
    if (!fc) throw new FeatureCodeNotFoundError(id);

    const errors: string[] = [];

    if (fc.status !== 'draft') {
      errors.push(`Feature code is not in draft status: ${fc.status}`);
    }

    try {
      this.validateCode(fc.code);
    } catch (err) {
      if (err instanceof FeatureCodeConflictError) {
        errors.push(err.message);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private validateCode(code: string): void {
    // Reject empty or overly long codes
    if (!code || code.length > 20) {
      throw new FeatureCodeConflictError('Feature code must be 1–20 characters');
    }
    // Reject codes that are pure emergency numbers
    const stripped = code.replace(/^\*+/, '').replace(/^#+/, '');
    if (GLOBAL_EMERGENCY_NUMBERS.has(stripped)) {
      throw new FeatureCodeConflictError(
        `Feature code ${code} shadows an emergency number and cannot be used`,
      );
    }
  }

  static isAllowedActionType(type: string): type is FeatureCodeActionType {
    return (FEATURE_CODE_ACTION_TYPES as readonly string[]).includes(type);
  }
}
