import { z } from '../registry.js';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const MessageDirectionSchema = z.enum(['inbound', 'outbound']);
export type MessageDirection = z.infer<typeof MessageDirectionSchema>;

export const MessageTypeSchema = z.enum([
  'text',
  'voice_message',
  'meeting',
  'image',
  'document',
]);
export type MessageType = z.infer<typeof MessageTypeSchema>;

export const MessageRequestStatusSchema = z.enum(['queued', 'sent', 'failed']);
export type MessageRequestStatus = z.infer<typeof MessageRequestStatusSchema>;

// ── Resource schemas ──────────────────────────────────────────────────────────
export const ChannelMessageSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  channel_account_id: z.string().uuid(),
  direction: MessageDirectionSchema,
  message_type: MessageTypeSchema,
  external_id: z.string().nullable(),
  sender_id: z.string().nullable(),
  recipient_id: z.string().nullable(),
  body: z.string().nullable(),
  media_reference: z.string().nullable(),
  provider_metadata: z.record(z.unknown()),
  received_at: z.string().datetime(),
  created_at: z.string().datetime(),
}).openapi('ChannelMessage');
export type ChannelMessage = z.infer<typeof ChannelMessageSchema>;

export const ChannelMessageRequestSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  channel_account_id: z.string().uuid(),
  recipient_id: z.string(),
  message_type: MessageTypeSchema,
  body: z.string().nullable(),
  media_reference: z.string().nullable(),
  status: MessageRequestStatusSchema,
  failure_reason: z.string().nullable(),
  provider_metadata: z.record(z.unknown()),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('ChannelMessageRequest');
export type ChannelMessageRequest = z.infer<typeof ChannelMessageRequestSchema>;

// ── Request schemas ───────────────────────────────────────────────────────────
export const IngestInboundMessageBodySchema = z.object({
  channel_account_id: z.string().uuid(),
  message_type: MessageTypeSchema,
  external_id: z.string().optional(),
  sender_id: z.string().optional(),
  recipient_id: z.string().optional(),
  body: z.string().optional(),
  media_reference: z.string().optional(),
  provider_metadata: z.record(z.unknown()).optional(),
  received_at: z.string().datetime().optional(),
}).openapi('IngestInboundMessageBody');
export type IngestInboundMessageBody = z.infer<typeof IngestInboundMessageBodySchema>;

export const CreateOutboundMessageBodySchema = z.object({
  channel_account_id: z.string().uuid(),
  recipient_id: z.string().min(1),
  message_type: MessageTypeSchema,
  body: z.string().optional(),
  media_reference: z.string().optional(),
  provider_metadata: z.record(z.unknown()).optional(),
}).openapi('CreateOutboundMessageBody');
export type CreateOutboundMessageBody = z.infer<typeof CreateOutboundMessageBodySchema>;
