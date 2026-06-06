import { z } from '../registry.js';

// ── Resource schemas ──────────────────────────────────────────────────────────
export const QueueStatSchema = z.object({
  queue_id: z.string().uuid(),
  queue_name: z.string(),
  strategy: z.string(),
  status: z.string(),
  member_count: z.number().int(),
  sla_target_seconds: z.number().int(),
  pending_callbacks: z.number().int(),
}).openapi('QueueStat');
export type QueueStat = z.infer<typeof QueueStatSchema>;

export const AgentSummarySchema = z.object({
  agent_profile_id: z.string().uuid(),
  display_name: z.string(),
  state: z.string().nullable(),
  reason: z.string().nullable(),
  queue_count: z.number().int(),
}).openapi('AgentSummary');
export type AgentSummary = z.infer<typeof AgentSummarySchema>;

export const SlaMetricSchema = z.object({
  queue_id: z.string().uuid(),
  queue_name: z.string(),
  sla_target_seconds: z.number().int(),
  pending_callbacks: z.number().int(),
  scheduled_callbacks: z.number().int(),
  reached_callbacks: z.number().int(),
  expired_callbacks: z.number().int(),
}).openapi('SlaMetric');
export type SlaMetric = z.infer<typeof SlaMetricSchema>;

export const DashboardViewSchema = z.object({
  queues: z.array(QueueStatSchema),
  agents: z.array(AgentSummarySchema),
  sla_metrics: z.array(SlaMetricSchema),
  captured_at: z.string().datetime(),
}).openapi('DashboardView');
export type DashboardView = z.infer<typeof DashboardViewSchema>;

export const WallboardViewSchema = z.object({
  queues: z.array(QueueStatSchema),
  agents_available: z.number().int(),
  agents_busy: z.number().int(),
  agents_away: z.number().int(),
  agents_offline: z.number().int(),
  captured_at: z.string().datetime(),
}).openapi('WallboardView');
export type WallboardView = z.infer<typeof WallboardViewSchema>;
