// Webhook schemas are part of the automation module.
// Re-export from automation for convenience.
export {
  WebhookEventSchema,
  WebhookDeliveryStatusSchema,
  AutomationWebhookSchema,
  AutomationWebhookCreatedSchema,
  WebhookDeliveryAttemptSchema,
  WebhookDeliveryQueueItemSchema,
  CreateAutomationWebhookBodySchema,
  WEBHOOK_EVENTS,
} from './automation.js';

export type {
  WebhookEvent,
  WebhookDeliveryStatus,
  AutomationWebhook,
  AutomationWebhookCreated,
  WebhookDeliveryAttempt,
  WebhookDeliveryQueueItem,
  CreateAutomationWebhookBody,
} from './automation.js';
