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
  'approval.approved',
  'approval.rejected',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];
