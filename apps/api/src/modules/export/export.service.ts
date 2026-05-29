import type { ExportFilter, ExportRepository, SessionExportRow } from './export.repository.js';
import type { CallEvent } from '../call-events/call-event.types.js';

export class ExportService {
  constructor(private readonly repo: ExportRepository) {}

  async exportCallEvents(tenantId: string, filter: ExportFilter): Promise<CallEvent[]> {
    return this.repo.exportCallEvents(tenantId, filter);
  }

  async exportSessions(tenantId: string, filter: ExportFilter): Promise<SessionExportRow[]> {
    return this.repo.exportSessions(tenantId, filter);
  }
}
