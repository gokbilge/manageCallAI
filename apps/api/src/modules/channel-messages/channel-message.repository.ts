import type { Pool } from 'pg';
import type {
  ClaimOutboundMessageInput,
  ChannelMessage,
  ChannelMessageRequest,
  CompleteOutboundMessageInput,
  CreateOutboundMessageInput,
  IngestInboundMessageInput,
} from './channel-message.types.js';

const MSG_COLS = `id, tenant_id, channel_account_id, direction, message_type, external_id, sender_id, recipient_id, body, media_reference, provider_metadata, received_at, created_at`;
const REQ_COLS = `id, tenant_id, channel_account_id, recipient_id, message_type, body, media_reference, status, failure_reason, processor_id, claimed_at, completed_at, external_id, provider_metadata, created_at, updated_at`;
const REQ_RETURNING_COLS = REQ_COLS.split(', ')
  .map((column) => `r.${column}`)
  .join(', ');

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

  async claimNextOutboundRequest(input: ClaimOutboundMessageInput): Promise<ChannelMessageRequest | null> {
    const params: unknown[] = [
      input.tenant_id,
      input.processor_id ?? null,
    ];
    const accountFilter = input.channel_account_id ? 'AND channel_account_id = $3' : '';
    if (input.channel_account_id) params.push(input.channel_account_id);

    const r = await this.db.query<ChannelMessageRequest>(
      `WITH next_request AS (
         SELECT id FROM channel_message_requests
         WHERE tenant_id = $1
           AND status = 'queued'
           ${accountFilter}
         ORDER BY created_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       UPDATE channel_message_requests r
       SET status = 'processing',
           processor_id = $2,
           claimed_at = NOW(),
           updated_at = NOW()
       FROM next_request
       WHERE r.id = next_request.id
       RETURNING ${REQ_RETURNING_COLS}`,
      params,
    );
    return r.rows[0] ?? null;
  }

  async completeOutboundRequest(
    requestId: string,
    input: CompleteOutboundMessageInput,
  ): Promise<ChannelMessageRequest | null> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query<ChannelMessageRequest>(
        `UPDATE channel_message_requests
         SET status = $2,
             failure_reason = $3,
             external_id = $4,
             provider_metadata = provider_metadata || $5::jsonb,
             completed_at = NOW(),
             updated_at = NOW()
         WHERE id = $1 AND status = 'processing'
         RETURNING ${REQ_COLS}`,
        [
          requestId,
          input.status,
          input.failure_reason ?? null,
          input.external_id ?? null,
          JSON.stringify(input.provider_metadata ?? {}),
        ],
      );
      const request = r.rows[0] ?? null;
      if (request && input.status === 'sent') {
        await client.query(
          `INSERT INTO channel_messages
             (tenant_id, channel_account_id, direction, message_type, external_id, recipient_id, body, media_reference, provider_metadata)
           VALUES ($1, $2, 'outbound', $3, $4, $5, $6, $7, $8)`,
          [
            request.tenant_id,
            request.channel_account_id,
            request.message_type,
            input.external_id ?? null,
            request.recipient_id,
            request.body,
            request.media_reference,
            JSON.stringify(input.provider_metadata ?? request.provider_metadata ?? {}),
          ],
        );
      }
      await client.query('COMMIT');
      return request;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async findChannelAccount(tenantId: string, channelAccountId: string): Promise<{ id: string } | null> {
    const r = await this.db.query<{ id: string }>(
      `SELECT id FROM channel_accounts WHERE id = $1 AND tenant_id = $2 AND status = 'active'`,
      [channelAccountId, tenantId],
    );
    return r.rows[0] ?? null;
  }
}
