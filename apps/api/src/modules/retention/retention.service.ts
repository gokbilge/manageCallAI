import type { RetentionRepository } from './retention.repository.js';
import type {
  CreateLegalHoldInput,
  LegalHold,
  RetentionPolicy,
  UpdateRetentionPolicyInput,
} from './retention.types.js';

export class LegalHoldNotFoundError extends Error {
  constructor(id: string) {
    super(`Legal hold not found or already released: ${id}`);
    this.name = 'LegalHoldNotFoundError';
  }
}

const RETENTION_BOUNDS: Record<string, { min: number; max: number }> = {
  recording_retention_days: { min: 1, max: 2555 },
  voicemail_retention_days: { min: 1, max: 2555 },
  transcript_retention_days: { min: 1, max: 2555 },
  ai_summary_retention_days: { min: 1, max: 2555 },
  cdr_retention_days: { min: 30, max: 2555 },
  call_event_retention_days: { min: 7, max: 2555 },
  generated_media_retention_days: { min: 30, max: 2555 },
};

export class RetentionService {
  constructor(private readonly repo: RetentionRepository) {}

  async getPolicy(tenantId: string): Promise<RetentionPolicy | null> {
    return this.repo.getPolicy(tenantId);
  }

  async updatePolicy(tenantId: string, input: UpdateRetentionPolicyInput): Promise<RetentionPolicy> {
    for (const [field, value] of Object.entries(input)) {
      if (value == null) continue;
      const bounds = RETENTION_BOUNDS[field];
      if (!bounds) continue;
      if (value < bounds.min || value > bounds.max) {
        throw new RetentionBoundsError(field, value, bounds.min, bounds.max);
      }
    }
    return this.repo.upsertPolicy(tenantId, input);
  }

  async listLegalHolds(tenantId: string, activeOnly = true): Promise<LegalHold[]> {
    return this.repo.listLegalHolds(tenantId, activeOnly);
  }

  async createLegalHold(tenantId: string, input: CreateLegalHoldInput): Promise<LegalHold> {
    return this.repo.createLegalHold(tenantId, input);
  }

  async releaseLegalHold(id: string, tenantId: string, releasedBy: string): Promise<LegalHold> {
    const hold = await this.repo.releaseLegalHold(id, tenantId, releasedBy);
    if (!hold) throw new LegalHoldNotFoundError(id);
    return hold;
  }
}

export class RetentionBoundsError extends Error {
  constructor(field: string, value: number, min: number, max: number) {
    super(`${field} value ${value} is out of bounds [${min}, ${max}]`);
    this.name = 'RetentionBoundsError';
  }
}
