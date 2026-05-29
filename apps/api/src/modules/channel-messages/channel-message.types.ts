export type MessageDirection = 'inbound' | 'outbound';
export type MessageType = 'text' | 'voice_message' | 'meeting' | 'image' | 'document';
export type VoiceCapability = 'voice_message' | 'native_call' | 'meeting' | 'sip_bridge';

export interface ChannelMessage {
  id: string;
  tenant_id: string;
  channel_account_id: string;
  direction: MessageDirection;
  message_type: MessageType;
  external_id: string | null;
  sender_id: string | null;
  recipient_id: string | null;
  body: string | null;
  media_reference: string | null;
  provider_metadata: Record<string, unknown>;
  received_at: Date;
  created_at: Date;
}

export interface ChannelMessageRequest {
  id: string;
  tenant_id: string;
  channel_account_id: string;
  recipient_id: string;
  message_type: MessageType;
  body: string | null;
  media_reference: string | null;
  status: 'queued' | 'sent' | 'failed';
  failure_reason: string | null;
  provider_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface IngestInboundMessageInput {
  tenant_id: string;
  channel_account_id: string;
  message_type: MessageType;
  external_id?: string;
  sender_id?: string;
  recipient_id?: string;
  body?: string;
  media_reference?: string;
  provider_metadata?: Record<string, unknown>;
  received_at?: string;
}

export interface CreateOutboundMessageInput {
  tenant_id: string;
  channel_account_id: string;
  recipient_id: string;
  message_type: MessageType;
  body?: string;
  media_reference?: string;
  provider_metadata?: Record<string, unknown>;
}
