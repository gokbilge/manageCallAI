import { db } from '../../db/client.js';
import { AuditRepository, type LogAuditEventInput } from './audit.repository.js';
import { AuditService } from './audit.service.js';

const service = new AuditService(new AuditRepository(db));

export function fireAuditEvent(input: LogAuditEventInput): void {
  void service.logEvent(input).catch(() => {
    /* audit failures must not break the primary request */
  });
}
