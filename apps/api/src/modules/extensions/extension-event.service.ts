import { assertTenantScope, TenantScopeError } from '../domain-assertions.js';
import type { ExtensionEventRepository } from './extension-event.repository.js';
import type { ExtensionEvent, IngestExtensionEventInput, IngestExtensionEventResult } from './extension-event.types.js';

export { TenantScopeError };

export class ExtensionEventService {
  constructor(private readonly repo: ExtensionEventRepository) {}

  async ingest(input: IngestExtensionEventInput, runtimeTenantId?: string): Promise<IngestExtensionEventResult> {
    if (runtimeTenantId) {
      assertTenantScope(input.tenant_id, runtimeTenantId, 'Runtime tenant identity does not match event tenant_id');
    }

    const extensionId = await this.repo.findActiveExtensionId(input.tenant_id, input.extension_number);
    const event = await this.repo.create(input, extensionId);

    if (!event) {
      return { event: null, replayed: true };
    }

    await this.mirrorRegistrationState(input, extensionId);
    return { event, replayed: false };
  }

  listByExtension(tenantId: string, extensionNumber: string, limit: number): Promise<ExtensionEvent[]> {
    return this.repo.listByExtension(tenantId, extensionNumber, limit);
  }

  private async mirrorRegistrationState(input: IngestExtensionEventInput, extensionId: string | null): Promise<void> {
    try {
      if (input.event_type === 'registered') {
        await this.repo.upsertRegistration(input, extensionId);
      } else if (input.event_type === 'expired' || input.event_type === 'unregistered') {
        await this.repo.markRegistrationInactive(input, input.event_type);
      }
    } catch {
      // extension_registrations is an observability projection; ingestion remains authoritative.
    }
  }
}
