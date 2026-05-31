import { z } from '../registry.js';
import { ServiceHealthSchema } from './platform.js';

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

// ── SSE stream event ──────────────────────────────────────────────────────────
// Events emitted by the /api/v1/observability/stream SSE endpoint.
// status="live" means the snapshot is fresh; status="degraded" means the
// backend could not fetch a fresh snapshot (the data field will be null).
// Clients must not display degraded events as authoritative state — they
// should maintain the last known good snapshot and show an indicator.

export const StreamStatusSchema = z.enum(['live', 'degraded']);
export type StreamStatus = z.infer<typeof StreamStatusSchema>;

export const StreamEventSchema = z.object({
  status: StreamStatusSchema,
  data: LiveSnapshotSchema.nullable(),
  generated_at: z.string().datetime(),
}).openapi('StreamEvent');
export type StreamEvent = z.infer<typeof StreamEventSchema>;

// ── Platform health snapshot ──────────────────────────────────────────────────
// Aggregate runtime health visible to platform admins (PLATFORM_RUNTIME_VIEW).
// Never includes per-tenant data or cross-tenant sessions.

export const PlatformHealthSnapshotSchema = z.object({
  services: z.array(ServiceHealthSchema),
  active_sessions_total: z.number().int(),
  completed_sessions_24h: z.number().int(),
  failed_sessions_24h: z.number().int(),
  generated_at: z.string().datetime(),
}).openapi('PlatformHealthSnapshot');
export type PlatformHealthSnapshot = z.infer<typeof PlatformHealthSnapshotSchema>;
