import { z } from '../registry.js';

// ── Business event catalog ────────────────────────────────────────────────────
// Every event that can be emitted to webhook subscribers is defined here.
// Adding a new event requires: (1) add to WEBHOOK_EVENTS, (2) add a
// WEBHOOK_EVENT_DESCRIPTIONS entry, (3) fire it in the relevant service.
export const WEBHOOK_EVENTS = [
  // IVR flow lifecycle
  'ivr_flow.published',
  'ivr_flow.publish_pending',
  'ivr_flow.rollback_completed',
  'ivr_flow.validation_failed',
  // Approval workflow
  'approval.requested',
  'approval.approved',
  'approval.rejected',
  // Call events
  'call.completed',
  'call.started',
  // Voicemail
  'voicemail.recording_available',
  // Outbound calls
  'outbound_call.dispatched',
  'outbound_call.completed',
  'outbound_call.failed',
  // Extension registration
  'extension.registered',
  'extension.expired',
  // Recordings
  'recording.analysis_completed',
  'recording.analysis_failed',
] as const;

/** Human-readable descriptions for every business event. */
export const WEBHOOK_EVENT_DESCRIPTIONS: Record<(typeof WEBHOOK_EVENTS)[number], string> = {
  'ivr_flow.published': 'An IVR flow version was published and is now live.',
  'ivr_flow.publish_pending': 'An IVR flow publish request is awaiting human approval.',
  'ivr_flow.rollback_completed': 'An IVR flow was rolled back to the previous published version.',
  'ivr_flow.validation_failed': 'An IVR flow draft failed structural validation.',
  'approval.requested': 'A tenant action requires human approval.',
  'approval.approved': 'An approval request was approved.',
  'approval.rejected': 'An approval request was rejected.',
  'call.completed': 'An inbound or outbound call ended.',
  'call.started': 'An inbound or outbound call began.',
  'voicemail.recording_available': 'A voicemail recording was deposited and is available for retrieval.',
  'outbound_call.dispatched': 'An outbound call request was dispatched to FreeSWITCH.',
  'outbound_call.completed': 'A dispatched outbound call completed successfully.',
  'outbound_call.failed': 'A dispatched outbound call failed.',
  'extension.registered': 'A SIP extension successfully registered with FreeSWITCH.',
  'extension.expired': 'A SIP extension registration expired.',
  'recording.analysis_completed': 'A recording analysis job (transcription, summary) completed.',
  'recording.analysis_failed': 'A recording analysis job failed.',
};

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
  capabilities: z.array(z.string()),
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
  capabilities: z.array(z.string().min(1)).min(1),
}).openapi('CreateApiKeyBody');
export type CreateApiKeyBody = z.infer<typeof CreateApiKeyBodySchema>;

export const CreateAutomationWebhookBodySchema = z.object({
  name: z.string().min(1).max(255),
  url: z.string().min(1).max(2048),
  events: z.array(WebhookEventSchema).min(1),
}).openapi('CreateAutomationWebhookBody');
export type CreateAutomationWebhookBody = z.infer<typeof CreateAutomationWebhookBodySchema>;
