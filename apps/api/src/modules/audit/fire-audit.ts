import { db } from '../../db/client.js';
import { AuditRepository, type LogAuditEventInput } from './audit.repository.js';
import { AuditService } from './audit.service.js';

const service = new AuditService(new AuditRepository(db));

export function fireAuditEvent(input: LogAuditEventInput): void {
  void service.logEvent(input).catch((err: unknown) => {
    // Audit failures must not break the primary request, but must be visible.
    console.error('[audit] failed to write audit event', { action: input.action, err });
  });
}
