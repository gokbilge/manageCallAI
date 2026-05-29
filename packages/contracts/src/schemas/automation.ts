import { z } from '../registry.js';

// ── Constants ─────────────────────────────────────────────────────────────────
export const WEBHOOK_EVENTS = [
  'ivr_flow.published',
  'ivr_flow.publish_pending',
  'ivr_flow.rollback_completed',
  'ivr_flow.validation_failed',
  'approval.requested',
  'approval.approved',
  'approval.rejected',
  'call.completed',
  'voicemail.recording_available',
  'outbound_call.dispatched',
] as const;

export const WebhookEventSchema = z.enum(WEBHOOK_EVENTS);
export type WebhookEvent = z.infer<typeof WebhookEventSchema>;

// ── Enums ─────────────────────────────────────────────────────────────────────
export const WebhookDeliveryStatusSchema = z.enum([
  'pending',
  'processing',
  'delivered',
  'failed',
  'abandoned',
]);
export type WebhookDeliveryStatus = z.infer<typeof WebhookDeliveryStatusSchema>;

// ── Resource schemas ──────────────────────────────────────────────────────────
export const ApiKeySchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  key_prefix: z.string(),
  created_by: z.string().uuid().nullable(),
  created_at: z.string().datetime(),
  revoked_at: z.string().datetime().nullable(),
}).openapi('ApiKey');
export type ApiKey = z.infer<typeof ApiKeySchema>;

export const ApiKeyCreatedSchema = ApiKeySchema.extend({
  key: z.string(),
}).openapi('ApiKeyCreated');
export type ApiKeyCreated = z.infer<typeof ApiKeyCreatedSchema>;

export const AutomationWebhookSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  url: z.string(),
  events: z.array(z.string()),
  failure_count: z.number().int(),
  disabled_at: z.string().datetime().nullable(),
  created_by: z.string().uuid().nullable(),
  created_at: z.string().datetime(),
  revoked_at: z.string().datetime().nullable(),
}).openapi('AutomationWebhook');
export type AutomationWebhook = z.infer<typeof AutomationWebhookSchema>;

export const AutomationWebhookCreatedSchema = AutomationWebhookSchema.extend({
  signing_secret: z.string(),
}).openapi('AutomationWebhookCreated');
export type AutomationWebhookCreated = z.infer<typeof AutomationWebhookCreatedSchema>;

export const WebhookDeliveryAttemptSchema = z.object({
  id: z.string().uuid(),
  webhook_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  event: z.string(),
  attempt_number: z.number().int(),
  status: z.enum(['success', 'failed']),
  response_code: z.number().int().nullable(),
  duration_ms: z.number().int().nullable(),
  attempted_at: z.string().datetime(),
}).openapi('WebhookDeliveryAttempt');
export type WebhookDeliveryAttempt = z.infer<typeof WebhookDeliveryAttemptSchema>;

export const WebhookDeliveryQueueItemSchema = z.object({
  id: z.string().uuid(),
  webhook_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  event: z.string(),
  payload_json: z.record(z.unknown()),
  status: WebhookDeliveryStatusSchema,
  attempt_count: z.number().int(),
  max_attempts: z.number().int(),
  next_attempt_at: z.string().datetime(),
  claimed_at: z.string().datetime().nullable(),
  delivered_at: z.string().datetime().nullable(),
  last_response_code: z.number().int().nullable(),
  last_error: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('WebhookDeliveryQueueItem');
export type WebhookDeliveryQueueItem = z.infer<typeof WebhookDeliveryQueueItemSchema>;

// ── Request schemas ───────────────────────────────────────────────────────────
export const CreateApiKeyBodySchema = z.object({
  name: z.string().min(1).max(255),
}).openapi('CreateApiKeyBody');
export type CreateApiKeyBody = z.infer<typeof CreateApiKeyBodySchema>;

export const CreateAutomationWebhookBodySchema = z.object({
  name: z.string().min(1).max(255),
  url: z.string().min(1).max(2048),
  events: z.array(WebhookEventSchema).min(1),
}).openapi('CreateAutomationWebhookBody');
export type CreateAutomationWebhookBody = z.infer<typeof CreateAutomationWebhookBodySchema>;
