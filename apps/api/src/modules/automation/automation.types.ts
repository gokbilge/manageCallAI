export interface ApiKey {
  id: string;
  tenant_id: string;
  name: string;
  key_prefix: string;
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
  'outbound_call.dispatched',
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

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];
