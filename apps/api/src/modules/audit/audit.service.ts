import type { AuditLogEntry, AuditLogFilter, AuditRepository, LogAuditEventInput } from './audit.repository.js';

export class AuditService {
  constructor(private readonly repo: AuditRepository) {}

  async logEvent(input: LogAuditEventInput): Promise<void> {
    await this.repo.log(input);
  }

  async getAuditLog(tenantId: string, filter: AuditLogFilter = {}): Promise<AuditLogEntry[]> {
    return this.repo.find(tenantId, filter);
  }
}
