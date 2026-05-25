import type { CallEventRepository } from './call-event.repository.js';
import type { CallEvent, IngestCallEventInput } from './call-event.types.js';

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';

export class CallEventService {
  constructor(private readonly repo: CallEventRepository) {}

  listByTenant(tenantId: string): Promise<CallEvent[]> {
    return this.repo.listByTenant(tenantId);
  }

  ingest(input: IngestCallEventInput): Promise<CallEvent> {
    return this.repo.create({
      tenant_id: input.tenant_id ?? DEFAULT_TENANT_ID,
      call_id: input.call_id,
      event_type: input.event_type,
      event_time: input.event_time,
      source: input.source,
      payload: input.payload,
    });
  }
}
