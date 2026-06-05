import type { Pool } from 'pg';
import type {
  ExtensionSelfServiceState,
  ResetSipCredentialResult,
  SelfServiceCallEvent,
  SelfServiceDeviceRegistration,
  SelfServicePolicy,
  SelfServiceVoicemailMessage,
  UpdateSelfServicePolicyInput,
} from './self-service.types.js';

const POLICY_COLS = `
  id, tenant_id, voicemail_view, voicemail_pin_change, dnd_manage,
  call_forward_manage, call_forward_set_target, call_history_view,
  device_view, sip_credential_reset,
  created_at, updated_at
`;

export class SelfServiceRepository {
  constructor(private readonly db: Pool) {}

  // Extension lookup by user sub (JWT sub = user.id → extensions.owner_user_id)
  async findExtensionByUserId(userId: string, tenantId: string): Promise<ExtensionSelfServiceState | null> {
    const r = await this.db.query<ExtensionSelfServiceState>(
      `SELECT id, extension_number, display_name, sip_username, dnd_enabled, call_forward_enabled, call_forward_target
       FROM extensions
       WHERE owner_user_id = $1 AND tenant_id = $2 AND status = 'active'
       LIMIT 1`,
      [userId, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async setDnd(extensionId: string, tenantId: string, enabled: boolean): Promise<ExtensionSelfServiceState | null> {
    const r = await this.db.query<ExtensionSelfServiceState>(
      `UPDATE extensions
       SET dnd_enabled = $3, updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, extension_number, display_name, sip_username, dnd_enabled, call_forward_enabled, call_forward_target`,
      [extensionId, tenantId, enabled],
    );
    return r.rows[0] ?? null;
  }

  async setCallForward(
    extensionId: string,
    tenantId: string,
    enabled: boolean,
    target?: string | null,
  ): Promise<ExtensionSelfServiceState | null> {
    const r = await this.db.query<ExtensionSelfServiceState>(
      `UPDATE extensions
       SET call_forward_enabled = $3,
           call_forward_target = COALESCE($4, call_forward_target),
           updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, extension_number, display_name, sip_username, dnd_enabled, call_forward_enabled, call_forward_target`,
      [extensionId, tenantId, enabled, target ?? null],
    );
    return r.rows[0] ?? null;
  }

  async findVoicemailBoxIdByExtensionNumber(
    tenantId: string,
    extensionNumber: string,
  ): Promise<string | null> {
    const result = await this.db.query<{ id: string }>(
      `SELECT id
       FROM voicemail_boxes
       WHERE tenant_id = $1
         AND mailbox_number = $2
         AND status = 'active'
       LIMIT 1`,
      [tenantId, extensionNumber],
    );
    return result.rows[0]?.id ?? null;
  }

  async listVoicemailMessagesByMailbox(
    tenantId: string,
    voicemailBoxId: string,
    options: { unreadOnly: boolean; limit: number },
  ): Promise<SelfServiceVoicemailMessage[]> {
    const result = await this.db.query<SelfServiceVoicemailMessage>(
      `SELECT id, tenant_id, voicemail_box_id, call_id, storage_path, duration_secs, size_bytes,
              read_at, deleted_at, recorded_at, created_at
       FROM voicemail_messages
       WHERE tenant_id = $1
         AND voicemail_box_id = $2
         AND deleted_at IS NULL
         ${options.unreadOnly ? 'AND read_at IS NULL' : ''}
       ORDER BY recorded_at DESC
       LIMIT $3`,
      [tenantId, voicemailBoxId, options.limit],
    );
    return result.rows;
  }

  async findVoicemailMessageForMailbox(
    id: string,
    tenantId: string,
    voicemailBoxId: string,
  ): Promise<SelfServiceVoicemailMessage | null> {
    const result = await this.db.query<SelfServiceVoicemailMessage>(
      `SELECT id, tenant_id, voicemail_box_id, call_id, storage_path, duration_secs, size_bytes,
              read_at, deleted_at, recorded_at, created_at
       FROM voicemail_messages
       WHERE id = $1
         AND tenant_id = $2
         AND voicemail_box_id = $3
         AND deleted_at IS NULL`,
      [id, tenantId, voicemailBoxId],
    );
    return result.rows[0] ?? null;
  }

  async markVoicemailReadForMailbox(
    id: string,
    tenantId: string,
    voicemailBoxId: string,
  ): Promise<SelfServiceVoicemailMessage | null> {
    const result = await this.db.query<SelfServiceVoicemailMessage>(
      `UPDATE voicemail_messages
       SET read_at = COALESCE(read_at, NOW())
       WHERE id = $1
         AND tenant_id = $2
         AND voicemail_box_id = $3
         AND deleted_at IS NULL
       RETURNING id, tenant_id, voicemail_box_id, call_id, storage_path, duration_secs, size_bytes,
                 read_at, deleted_at, recorded_at, created_at`,
      [id, tenantId, voicemailBoxId],
    );
    return result.rows[0] ?? null;
  }

  async softDeleteVoicemailForMailbox(
    id: string,
    tenantId: string,
    voicemailBoxId: string,
  ): Promise<boolean> {
    const result = await this.db.query<{ id: string }>(
      `UPDATE voicemail_messages
       SET deleted_at = NOW()
       WHERE id = $1
         AND tenant_id = $2
         AND voicemail_box_id = $3
         AND deleted_at IS NULL
       RETURNING id`,
      [id, tenantId, voicemailBoxId],
    );
    return result.rows.length > 0;
  }

  async listCallHistoryByExtensionNumber(
    tenantId: string,
    extensionNumber: string,
  ): Promise<SelfServiceCallEvent[]> {
    const result = await this.db.query<SelfServiceCallEvent>(
      `SELECT id, tenant_id, call_id, event_type, event_time, source, payload, ingested_at
       FROM call_events
       WHERE tenant_id = $1
         AND (
           payload->>'from_number' = $2
           OR payload->>'to_number' = $2
           OR payload->>'destination_number' = $2
           OR payload->>'caller_number' = $2
           OR payload->>'extension_number' = $2
           OR payload->'metadata'->>'from_number' = $2
           OR payload->'metadata'->>'to_number' = $2
           OR payload->'metadata'->>'destination_number' = $2
           OR payload->'metadata'->>'caller_number' = $2
           OR payload->'metadata'->>'extension_number' = $2
         )
       ORDER BY event_time DESC, ingested_at DESC
       LIMIT 500`,
      [tenantId, extensionNumber],
    );
    return result.rows;
  }

  async listDeviceRegistrationsByExtensionNumber(
    tenantId: string,
    extensionNumber: string,
  ): Promise<SelfServiceDeviceRegistration[]> {
    const result = await this.db.query<SelfServiceDeviceRegistration>(
      `SELECT id, tenant_id, extension_id, extension_number, status, contact_domain, user_agent,
              registered_at, last_seen_at, updated_at
       FROM extension_registrations
       WHERE tenant_id = $1
         AND extension_number = $2
       ORDER BY COALESCE(last_seen_at, registered_at, updated_at) DESC`,
      [tenantId, extensionNumber],
    );
    return result.rows;
  }

  async updateSipCredential(
    extensionId: string,
    tenantId: string,
    input: { sip_password_ciphertext: string; sip_password_key_id: string },
  ): Promise<ResetSipCredentialResult | null> {
    const result = await this.db.query<ResetSipCredentialResult>(
      `UPDATE extensions
       SET sip_password_ciphertext = $3,
           sip_password_key_id = $4,
           updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING id AS extension_id, extension_number, sip_username`,
      [extensionId, tenantId, input.sip_password_ciphertext, input.sip_password_key_id],
    );
    return result.rows[0] ?? null;
  }

  // Policy CRUD
  async findPolicy(tenantId: string): Promise<SelfServicePolicy | null> {
    const r = await this.db.query<SelfServicePolicy>(
      `SELECT ${POLICY_COLS} FROM end_user_self_service_policies WHERE tenant_id = $1`,
      [tenantId],
    );
    return r.rows[0] ?? null;
  }

  async upsertPolicy(tenantId: string, input: UpdateSelfServicePolicyInput): Promise<SelfServicePolicy> {
    const fields = Object.entries(input).filter(([, v]) => v !== undefined);
    const setClauses = fields.map(([k], i) => `${k} = $${i + 2}`).join(', ');
    const values = fields.map(([, v]) => v);

    if (fields.length === 0) {
      // No-op update — just ensure row exists
      const r = await this.db.query<SelfServicePolicy>(
        `INSERT INTO end_user_self_service_policies (tenant_id)
         VALUES ($1)
         ON CONFLICT (tenant_id) DO UPDATE SET updated_at = NOW()
         RETURNING ${POLICY_COLS}`,
        [tenantId],
      );
      return r.rows[0]!;
    }

    const r = await this.db.query<SelfServicePolicy>(
      `INSERT INTO end_user_self_service_policies (tenant_id, ${fields.map(([k]) => k).join(', ')})
       VALUES ($1, ${fields.map((_, i) => `$${i + 2}`).join(', ')})
       ON CONFLICT (tenant_id) DO UPDATE SET
         ${setClauses}, updated_at = NOW()
       RETURNING ${POLICY_COLS}`,
      [tenantId, ...values],
    );
    return r.rows[0]!;
  }
}
