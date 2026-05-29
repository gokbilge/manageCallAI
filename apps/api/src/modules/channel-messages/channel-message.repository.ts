import type { Pool } from 'pg';
import type {
  ChannelMessage,
  ChannelMessageRequest,
  CreateOutboundMessageInput,
  IngestInboundMessageInput,
} from './channel-message.types.js';

const MSG_COLS = `id, tenant_id, channel_account_id, direction, message_type, external_id, sender_id, recipient_id, body, media_reference, provider_metadata, received_at, created_at`;
const REQ_COLS = `id, tenant_id, channel_account_id, recipient_id, message_type, body, media_reference, status, failure_reason, provider_metadata, created_at, updated_at`;

export class ChannelMessageRepository {
  constructor(private readonly db: Pool) {}

  async ingestInbound(input: IngestInboundMessageInput): Promise<ChannelMessage> {
    const r = await this.db.query<ChannelMessage>(
      `INSERT INTO channel_messages
         (tenant_id, channel_account_id, direction, message_type, external_id, sender_id, recipient_id, body, media_reference, provider_metadata, received_at)
       VALUES ($1, $2, 'inbound', $3, $4, $5, $6, $7, $8, $9, COALESCE($10::timestamptz, now()))
       RETURNING ${MSG_COLS}`,
      [
        input.tenant_id,
        input.channel_account_id,
        input.message_type,
        input.external_id ?? null,
        input.sender_id ?? null,
        input.recipient_id ?? null,
        input.body ?? null,
        input.media_reference ?? null,
        JSON.stringify(input.provider_metadata ?? {}),
        input.received_at ?? null,
      ],
    );
    return r.rows[0]!;
  }

  async createOutboundRequest(input: CreateOutboundMessageInput): Promise<ChannelMessageRequest> {
    const r = await this.db.query<ChannelMessageRequest>(
      `INSERT INTO channel_message_requests
         (tenant_id, channel_account_id, recipient_id, message_type, body, media_reference, provider_metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${REQ_COLS}`,
      [
        input.tenant_id,
        input.channel_account_id,
        input.recipient_id,
        input.message_type,
        input.body ?? null,
        input.media_reference ?? null,
        JSON.stringify(input.provider_metadata ?? {}),
      ],
    );
    return r.rows[0]!;
  }

  async findMessagesByAccount(tenantId: string, channelAccountId: string, limit = 100): Promise<ChannelMessage[]> {
    const r = await this.db.query<ChannelMessage>(
      `SELECT ${MSG_COLS} FROM channel_messages
       WHERE tenant_id = $1 AND channel_account_id = $2
       ORDER BY received_at DESC
       LIMIT $3`,
      [tenantId, channelAccountId, limit],
    );
    return r.rows;
  }

  async findRequestsByAccount(tenantId: string, channelAccountId: string, limit = 100): Promise<ChannelMessageRequest[]> {
    const r = await this.db.query<ChannelMessageRequest>(
      `SELECT ${REQ_COLS} FROM channel_message_requests
       WHERE tenant_id = $1 AND channel_account_id = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [tenantId, channelAccountId, limit],
    );
    return r.rows;
  }

  async findChannelAccount(tenantId: string, channelAccountId: string): Promise<{ id: string } | null> {
    const r = await this.db.query<{ id: string }>(
      `SELECT id FROM channel_accounts WHERE id = $1 AND tenant_id = $2 AND status = 'active'`,
      [channelAccountId, tenantId],
    );
    return r.rows[0] ?? null;
  }
}
