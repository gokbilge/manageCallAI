import { z } from '../registry.js';

// ── Business event catalog ────────────────────────────────────────────────────
// Every event that can be emitted to webhook subscribers is defined here.
// Adding a new event requires: (1) add to WEBHOOK_EVENTS, (2) add a
// WEBHOOK_EVENT_DESCRIPTIONS entry, (3) add a payload schema below,
// (4) fire it in the relevant service.
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

// ── API key capability catalog ─────────────────────────────────────────────────
// Canonical list of capability strings recognised by the API.
// A single-element array containing '*' grants the full tenant_admin set (legacy).
// New keys should always specify an explicit subset from this list.
export const API_KEY_CAPABILITIES = [
  // platform
  'platform.tenants.view',
  'platform.runtime.view',
  'platform.audit.view',
  // tenant — dashboard / calls
  'tenant.dashboard.view',
  'tenant.calls.view',
  // tenant — extensions
  'tenant.extensions.view',
  'tenant.extensions.create',
  'tenant.extensions.update',
  'tenant.extensions.deactivate',
  'tenant.directory_smoke_test.run',
  // tenant — phone numbers
  'tenant.phone_numbers.view',
  'tenant.phone_numbers.create',
  'tenant.phone_numbers.update',
  'tenant.phone_numbers.deactivate',
  // tenant — inbound routes
  'tenant.inbound_routes.view',
  'tenant.inbound_routes.create',
  'tenant.inbound_routes.update',
  'tenant.inbound_routes.activate',
  'tenant.inbound_routes.deactivate',
  'tenant.inbound_routes.test',
  // tenant — prompts
  'tenant.prompts.view',
  'tenant.prompts.create',
  'tenant.prompts.update',
  'tenant.prompts.deactivate',
  // tenant — IVR flows
  'tenant.ivr_flows.view',
  'tenant.ivr_flows.create',
  'tenant.ivr_flows.update',
  'tenant.ivr_flows.validate',
  'tenant.ivr_flows.simulate',
  'tenant.ivr_flows.publish',
  'tenant.ivr_flows.rollback',
  // tenant — approvals
  'tenant.approvals.view',
  'tenant.approvals.decide',
  // tenant — call groups
  'tenant.call_groups.view',
  'tenant.call_groups.create',
  'tenant.call_groups.update',
  'tenant.call_groups.deactivate',
  // tenant — queues
  'tenant.queues.view',
  'tenant.queues.create',
  'tenant.queues.update',
  'tenant.queues.deactivate',
  // tenant — voicemail
  'tenant.voicemail_boxes.view',
  'tenant.voicemail_boxes.create',
  'tenant.voicemail_boxes.update',
  'tenant.voicemail_boxes.deactivate',
  // tenant — automation
  'tenant.automation.keys.view',
  'tenant.automation.keys.manage',
  'tenant.automation.webhooks.view',
  'tenant.automation.webhooks.manage',
  // tenant — schedules
  'tenant.schedules.view',
  'tenant.schedules.create',
  'tenant.schedules.update',
  'tenant.conference_rooms.view',
  'tenant.conference_rooms.create',
  'tenant.conference_rooms.update',
  'tenant.conference_rooms.deactivate',
  // tenant — feature codes
  'tenant.feature_codes.view',
  'tenant.feature_codes.create',
  'tenant.feature_codes.update',
  'tenant.feature_codes.validate',
  'tenant.feature_codes.publish',
  'tenant.feature_codes.deactivate',
  // tenant — outbound routes
  'tenant.outbound_routes.view',
  'tenant.outbound_routes.create',
  'tenant.outbound_routes.update',
  // tenant — outbound calls
  'tenant.outbound_calls.create',
  'tenant.outbound_calls.view',
  // tenant — channels
  'tenant.channel_accounts.view',
  'tenant.channel_accounts.manage',
  'tenant.channel_messages.view',
  'tenant.channel_messages.send',
  'tenant.meeting_sessions.view',
  'tenant.meeting_sessions.manage',
  // tenant — audit / export / users
  'tenant.audit_log.view',
  'tenant.recordings.view',
  'tenant.export.run',
  'tenant.users.view',
  'tenant.users.manage',
  // tenant — compliance and retention (SLICE-47)
  'tenant.compliance.admin',
  // tenant — security alerts (SLICE-48)
  'tenant.security.alerts.view',
  'tenant.security.alerts.manage',
  // tenant — fraud policy (SLICE-45)
  'tenant.fraud_policy.view',
  'tenant.fraud_policy.manage',
  // tenant — risk analysis (v0.6)
  'tenant.risk_analysis.run',
  // tenant — natural-language reporting (v0.6)
  'tenant.reporting.nl_query',
  // tenant — call failure explanation (v0.6)
  'tenant.calls.explain_failure',
  // tenant — provider-backed AI policy and use (v0.6.1)
  'tenant.ai.policy.view',
  'tenant.ai.policy.manage',
  'tenant.ai.provider_backed.use',
  // legacy sentinel — grants full tenant_admin set
  '*',
] as const;

export const ApiKeyCapabilitySchema = z.enum(API_KEY_CAPABILITIES);
export type ApiKeyCapability = z.infer<typeof ApiKeyCapabilitySchema>;

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
  capabilities: z.array(ApiKeyCapabilitySchema),
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

// ── Webhook payload envelope ──────────────────────────────────────────────────
// Every outbound webhook delivery wraps its event-specific data in this envelope.
// Receivers should verify X-ManageCall-Signature-256 against this body and check
// that |now - X-ManageCall-Timestamp| <= 300 before processing.
export const WebhookPayloadEnvelopeSchema = z.object({
  id: z.string().uuid(),
  event: WebhookEventSchema,
  tenant_id: z.string().uuid(),
  timestamp: z.string().datetime(),
  version: z.literal(1),
  data: z.record(z.unknown()),
}).openapi('WebhookPayloadEnvelope');
export type WebhookPayloadEnvelope = z.infer<typeof WebhookPayloadEnvelopeSchema>;

// ── Per-event payload schemas ─────────────────────────────────────────────────
// One schema per WEBHOOK_EVENTS entry. The `data` field of the envelope is typed
// by the matching payload schema. check-webhook-payloads.mjs enforces coverage.

export const IvrFlowPublishedPayloadSchema = z.object({
  flow_id: z.string().uuid(),
  flow_name: z.string(),
  version_id: z.string().uuid(),
  version_number: z.number().int(),
  triggered_by_type: z.enum(['user', 'workflow', 'ai_agent', 'system']),
  triggered_by_id: z.string().uuid().nullable(),
}).openapi('IvrFlowPublishedPayload');
export type IvrFlowPublishedPayload = z.infer<typeof IvrFlowPublishedPayloadSchema>;

export const IvrFlowPublishPendingPayloadSchema = z.object({
  flow_id: z.string().uuid(),
  flow_name: z.string(),
  version_id: z.string().uuid(),
  version_number: z.number().int(),
  approval_request_id: z.string().uuid(),
  triggered_by_type: z.enum(['user', 'workflow', 'ai_agent', 'system']),
  triggered_by_id: z.string().uuid().nullable(),
}).openapi('IvrFlowPublishPendingPayload');
export type IvrFlowPublishPendingPayload = z.infer<typeof IvrFlowPublishPendingPayloadSchema>;

export const IvrFlowRollbackCompletedPayloadSchema = z.object({
  flow_id: z.string().uuid(),
  flow_name: z.string(),
  rolled_back_to_version_id: z.string().uuid(),
  triggered_by_type: z.enum(['user', 'workflow', 'ai_agent', 'system']),
  triggered_by_id: z.string().uuid().nullable(),
}).openapi('IvrFlowRollbackCompletedPayload');
export type IvrFlowRollbackCompletedPayload = z.infer<typeof IvrFlowRollbackCompletedPayloadSchema>;

export const IvrFlowValidationFailedPayloadSchema = z.object({
  flow_id: z.string().uuid(),
  flow_name: z.string(),
  version_id: z.string().uuid(),
  error_count: z.number().int(),
}).openapi('IvrFlowValidationFailedPayload');
export type IvrFlowValidationFailedPayload = z.infer<typeof IvrFlowValidationFailedPayloadSchema>;

export const ApprovalRequestedPayloadSchema = z.object({
  approval_id: z.string().uuid(),
  object_type: z.string(),
  object_id: z.string().uuid(),
  requested_by: z.string().uuid().nullable(),
}).openapi('ApprovalRequestedPayload');
export type ApprovalRequestedPayload = z.infer<typeof ApprovalRequestedPayloadSchema>;

export const ApprovalApprovedPayloadSchema = z.object({
  approval_id: z.string().uuid(),
  object_type: z.string(),
  object_id: z.string().uuid(),
  decided_by: z.string().uuid().nullable(),
}).openapi('ApprovalApprovedPayload');
export type ApprovalApprovedPayload = z.infer<typeof ApprovalApprovedPayloadSchema>;

export const ApprovalRejectedPayloadSchema = z.object({
  approval_id: z.string().uuid(),
  object_type: z.string(),
  object_id: z.string().uuid(),
  decided_by: z.string().uuid().nullable(),
  note: z.string().nullable(),
}).openapi('ApprovalRejectedPayload');
export type ApprovalRejectedPayload = z.infer<typeof ApprovalRejectedPayloadSchema>;

export const CallCompletedPayloadSchema = z.object({
  call_id: z.string(),
  direction: z.enum(['inbound', 'outbound']),
  from_number: z.string().nullable(),
  to_number: z.string().nullable(),
  duration_seconds: z.number().int().nullable(),
  disposition: z.string().nullable(),
}).openapi('CallCompletedPayload');
export type CallCompletedPayload = z.infer<typeof CallCompletedPayloadSchema>;

export const CallStartedPayloadSchema = z.object({
  call_id: z.string(),
  direction: z.enum(['inbound', 'outbound']),
  from_number: z.string().nullable(),
  to_number: z.string().nullable(),
}).openapi('CallStartedPayload');
export type CallStartedPayload = z.infer<typeof CallStartedPayloadSchema>;

export const VoicemailRecordingAvailablePayloadSchema = z.object({
  recording_id: z.string().uuid(),
  mailbox_id: z.string().uuid(),
  call_id: z.string().nullable(),
  duration_seconds: z.number().int().nullable(),
}).openapi('VoicemailRecordingAvailablePayload');
export type VoicemailRecordingAvailablePayload = z.infer<typeof VoicemailRecordingAvailablePayloadSchema>;

export const OutboundCallDispatchedPayloadSchema = z.object({
  request_id: z.string().uuid(),
  extension_id: z.string().uuid(),
  dial_number: z.string(),
}).openapi('OutboundCallDispatchedPayload');
export type OutboundCallDispatchedPayload = z.infer<typeof OutboundCallDispatchedPayloadSchema>;

export const OutboundCallCompletedPayloadSchema = z.object({
  request_id: z.string().uuid(),
  call_id: z.string().nullable(),
  duration_seconds: z.number().int().nullable(),
}).openapi('OutboundCallCompletedPayload');
export type OutboundCallCompletedPayload = z.infer<typeof OutboundCallCompletedPayloadSchema>;

export const OutboundCallFailedPayloadSchema = z.object({
  request_id: z.string().uuid(),
  failure_reason: z.string().nullable(),
}).openapi('OutboundCallFailedPayload');
export type OutboundCallFailedPayload = z.infer<typeof OutboundCallFailedPayloadSchema>;

export const ExtensionRegisteredPayloadSchema = z.object({
  extension_id: z.string().uuid(),
  extension_number: z.string(),
}).openapi('ExtensionRegisteredPayload');
export type ExtensionRegisteredPayload = z.infer<typeof ExtensionRegisteredPayloadSchema>;

export const ExtensionExpiredPayloadSchema = z.object({
  extension_id: z.string().uuid(),
  extension_number: z.string(),
}).openapi('ExtensionExpiredPayload');
export type ExtensionExpiredPayload = z.infer<typeof ExtensionExpiredPayloadSchema>;

export const RecordingAnalysisCompletedPayloadSchema = z.object({
  analysis_id: z.string().uuid(),
  recording_id: z.string().uuid(),
  has_transcript: z.boolean(),
  has_summary: z.boolean(),
}).openapi('RecordingAnalysisCompletedPayload');
export type RecordingAnalysisCompletedPayload = z.infer<typeof RecordingAnalysisCompletedPayloadSchema>;

export const RecordingAnalysisFailedPayloadSchema = z.object({
  analysis_id: z.string().uuid(),
  recording_id: z.string().uuid(),
  error_message: z.string().nullable(),
}).openapi('RecordingAnalysisFailedPayload');
export type RecordingAnalysisFailedPayload = z.infer<typeof RecordingAnalysisFailedPayloadSchema>;

// ── Map from event name to its payload schema ──────────────────────────────────
// Used by check-webhook-payloads.mjs to enforce coverage.
export const WEBHOOK_PAYLOAD_SCHEMAS = {
  'ivr_flow.published': IvrFlowPublishedPayloadSchema,
  'ivr_flow.publish_pending': IvrFlowPublishPendingPayloadSchema,
  'ivr_flow.rollback_completed': IvrFlowRollbackCompletedPayloadSchema,
  'ivr_flow.validation_failed': IvrFlowValidationFailedPayloadSchema,
  'approval.requested': ApprovalRequestedPayloadSchema,
  'approval.approved': ApprovalApprovedPayloadSchema,
  'approval.rejected': ApprovalRejectedPayloadSchema,
  'call.completed': CallCompletedPayloadSchema,
  'call.started': CallStartedPayloadSchema,
  'voicemail.recording_available': VoicemailRecordingAvailablePayloadSchema,
  'outbound_call.dispatched': OutboundCallDispatchedPayloadSchema,
  'outbound_call.completed': OutboundCallCompletedPayloadSchema,
  'outbound_call.failed': OutboundCallFailedPayloadSchema,
  'extension.registered': ExtensionRegisteredPayloadSchema,
  'extension.expired': ExtensionExpiredPayloadSchema,
  'recording.analysis_completed': RecordingAnalysisCompletedPayloadSchema,
  'recording.analysis_failed': RecordingAnalysisFailedPayloadSchema,
} as const satisfies Record<(typeof WEBHOOK_EVENTS)[number], z.ZodTypeAny>;

// ── Request schemas ───────────────────────────────────────────────────────────
export const CreateApiKeyBodySchema = z.object({
  name: z.string().min(1).max(255),
  capabilities: z.array(ApiKeyCapabilitySchema).optional(),
}).openapi('CreateApiKeyBody');
export type CreateApiKeyBody = z.infer<typeof CreateApiKeyBodySchema>;

export const CreateAutomationWebhookBodySchema = z.object({
  name: z.string().min(1).max(255),
  url: z.string().min(1).max(2048),
  events: z.array(WebhookEventSchema).min(1),
}).openapi('CreateAutomationWebhookBody');
export type CreateAutomationWebhookBody = z.infer<typeof CreateAutomationWebhookBodySchema>;
