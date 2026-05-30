import { z } from '../registry.js';

// ── Sub-schemas ───────────────────────────────────────────────────────────────

export const RunningSessionSchema = z.object({
  id: z.string().uuid(),
  call_id: z.string(),
  flow_id: z.string().uuid(),
  caller_number: z.string().nullable(),
  current_node_id: z.string().nullable(),
  started_at: z.string().datetime(),
}).openapi('RunningSession');
export type RunningSession = z.infer<typeof RunningSessionSchema>;

export const QueueDepthSchema = z.object({
  queue_id: z.string().uuid(),
  queue_name: z.string(),
  member_count: z.number().int(),
}).openapi('QueueDepth');
export type QueueDepth = z.infer<typeof QueueDepthSchema>;

export const WebhookBacklogSchema = z.object({
  pending: z.number().int(),
  processing: z.number().int(),
  failed: z.number().int(),
  abandoned: z.number().int(),
}).openapi('WebhookBacklog');
export type WebhookBacklog = z.infer<typeof WebhookBacklogSchema>;

// ── Live snapshot ─────────────────────────────────────────────────────────────
// Point-in-time operational view for the tenant observability cockpit.
// No provider secrets, raw switch payloads, or cross-tenant data are included.

export const LiveSnapshotSchema = z.object({
  tenant_id: z.string().uuid(),
  active_session_count: z.number().int(),
  running_sessions: z.array(RunningSessionSchema),
  queue_depths: z.array(QueueDepthSchema),
  webhook_backlog: WebhookBacklogSchema,
  recent_call_events_5m: z.number().int(),
  recent_session_failures_1h: z.number().int(),
  pending_approvals: z.number().int(),
  generated_at: z.string().datetime(),
}).openapi('LiveSnapshot');
export type LiveSnapshot = z.infer<typeof LiveSnapshotSchema>;

// ── Response wrapper ──────────────────────────────────────────────────────────
export const LiveSnapshotResponseSchema = z.object({
  data: LiveSnapshotSchema,
}).openapi('LiveSnapshotResponse');
export type LiveSnapshotResponse = z.infer<typeof LiveSnapshotResponseSchema>;
