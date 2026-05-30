import type { ObservabilityRepository } from './observability.repository.js';
import type { LiveSnapshot } from './observability.types.js';

export class ObservabilityService {
  constructor(private readonly repo: ObservabilityRepository) {}

  getSnapshot(tenantId: string): Promise<LiveSnapshot> {
    return this.repo.getSnapshot(tenantId);
  }
}
