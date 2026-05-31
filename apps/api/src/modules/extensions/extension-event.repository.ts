import type { Pool } from 'pg';
import type { ExtensionEvent, IngestExtensionEventInput } from './extension-event.types.js';

export class ExtensionEventRepository {
  constructor(private readonly db: Pool) {}

  async findActiveExtensionId(tenantId: string, extensionNumber: string): Promise<string | null> {
    const result = await this.db.query<{ id: string }>(
      `SELECT id
       FROM extensions
       WHERE tenant_id = $1 AND extension_number = $2 AND status = 'active'`,
      [tenantId, extensionNumber],
    );
    return result.rows[0]?.id ?? null;
  }

  async create(input: IngestExtensionEventInput, extensionId: string | null): Promise<ExtensionEvent | null> {
    const result = await this.db.query<ExtensionEvent>(
      `INSERT INTO extension_event_log
         (tenant_id, extension_id, extension_number, event_type, contact_domain,
          user_agent, source_ip, freeswitch_event_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (tenant_id, freeswitch_event_id) WHERE freeswitch_event_id IS NOT NULL DO NOTHING
       RETURNING id, tenant_id, extension_id, extension_number, event_type, contact_domain,
                 user_agent, source_ip, freeswitch_event_id, created_at`,
      [
        input.tenant_id,
        extensionId,
        input.extension_number,
        input.event_type,
        input.contact_domain ?? null,
        input.user_agent ?? null,
        input.source_ip ?? null,
        input.freeswitch_event_id ?? null,
      ],
    );
    return result.rows[0] ?? null;
  }

  async upsertRegistration(input: IngestExtensionEventInput, extensionId: string | null): Promise<void> {
    await this.db.query(
      `INSERT INTO extension_registrations
         (tenant_id, extension_id, extension_number, status, contact_domain, user_agent, registered_at, last_seen_at)
       VALUES ($1, $2, $3, 'registered', $4, $5, NOW(), NOW())
       ON CONFLICT (tenant_id, extension_number) DO UPDATE
         SET status = 'registered',
             extension_id = EXCLUDED.extension_id,
             contact_domain = EXCLUDED.contact_domain,
             user_agent = EXCLUDED.user_agent,
             registered_at = NOW(),
             last_seen_at = NOW(),
             updated_at = NOW()`,
      [input.tenant_id, extensionId, input.extension_number, input.contact_domain ?? null, input.user_agent ?? null],
    );
  }

  async markRegistrationInactive(input: IngestExtensionEventInput, status: 'expired' | 'unregistered'): Promise<void> {
    await this.db.query(
      `UPDATE extension_registrations
       SET status = $3, last_seen_at = NOW(), updated_at = NOW()
       WHERE tenant_id = $1 AND extension_number = $2`,
      [input.tenant_id, input.extension_number, status],
    );
  }

  async listByExtension(tenantId: string, extensionNumber: string, limit: number): Promise<ExtensionEvent[]> {
    const result = await this.db.query<ExtensionEvent>(
      `SELECT id, tenant_id, extension_id, extension_number, event_type, contact_domain,
              user_agent, source_ip, freeswitch_event_id, created_at
       FROM extension_event_log
       WHERE tenant_id = $1 AND extension_number = $2
       ORDER BY created_at DESC LIMIT $3`,
      [tenantId, extensionNumber, limit],
    );
    return result.rows;
  }
}
