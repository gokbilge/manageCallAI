import { db } from '../../db/client.js';
import { AuditRepository, type LogAuditEventInput } from './audit.repository.js';
import { AuditService } from './audit.service.js';

const service = new AuditService(new AuditRepository(db));

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function fireAuditEvent(input: LogAuditEventInput): void {
  // tenant_audit_log.tenant_id is a UUID column — skip silently if caller
  // passes an empty string or non-UUID (e.g., runtime endpoints with no tenant header).
  if (!UUID_RE.test(input.tenant_id)) return;
  void service.logEvent(input).catch(() => {
    /* audit failures must not break the primary request */
  });
}
