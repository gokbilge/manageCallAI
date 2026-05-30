export interface ApiKey {
  id: string;
  tenant_id: string;
  name: string;
  key_prefix: string;
  /** Explicit capability list. ['*'] = full tenant_admin set (legacy default). */
  capabilities: string[];
  created_by: string | null;
  created_at: Date;
  revoked_at: Date | null;
}

export interface ApiKeyCreated extends ApiKey {
  key: string;
}

export interface AutomationWebhook {
  id: string;
  tenant_id: string;
  name: string;
  url: string;
  events: string[];
  failure_count: number;
  disabled_at: Date | null;
  created_by: string | null;
  created_at: Date;
  revoked_at: Date | null;
}

export interface AutomationWebhookCreated extends AutomationWebhook {
  signing_secret: string;
}

export const WEBHOOK_EVENTS = [
  'ivr_flow.published',
  'ivr_flow.publish_pending',
  'ivr_flow.rollback_completed',
  'ivr_flow.validation_failed',
  'approval.requested',
  'approval.approved',
  'approval.rejected',
  'call.completed',
  'call.started',
  'voicemail.recording_available',
  'outbound_call.dispatched',
  'outbound_call.completed',
  'outbound_call.failed',
  'extension.registered',
  'extension.expired',
  'recording.analysis_completed',
  'recording.analysis_failed',
] as const;

export interface WebhookDeliveryAttempt {
  id: string;
  webhook_id: string;
  tenant_id: string;
  event: string;
  attempt_number: number;
  status: 'success' | 'failed';
  response_code: number | null;
  duration_ms: number | null;
  attempted_at: Date;
}

export type WebhookDeliveryStatus = 'pending' | 'processing' | 'delivered' | 'failed' | 'abandoned';

export interface WebhookDeliveryQueueItem {
  id: string;
  webhook_id: string;
  tenant_id: string;
  event: string;
  payload_json: Record<string, unknown>;
  status: WebhookDeliveryStatus;
  attempt_count: number;
  max_attempts: number;
  next_attempt_at: Date;
  claimed_at: Date | null;
  delivered_at: Date | null;
  last_response_code: number | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ClaimedWebhookDelivery extends WebhookDeliveryQueueItem {
  url: string;
  signing_secret: string;
}

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];
