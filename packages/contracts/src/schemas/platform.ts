import { z } from '../registry.js';

// ── Resource schemas ──────────────────────────────────────────────────────────
export const TenantSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  directory_domain: z.string(),
  status: z.string(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('TenantSummary');
export type TenantSummary = z.infer<typeof TenantSummarySchema>;

export const ServiceHealthSchema = z.object({
  name: z.string(),
  url: z.string(),
  status: z.enum(['healthy', 'degraded', 'unreachable']),
  detail: z.string(),
}).openapi('ServiceHealth');
export type ServiceHealth = z.infer<typeof ServiceHealthSchema>;

export const RuntimeHealthSummarySchema = z.object({
  services: z.array(ServiceHealthSchema),
}).openapi('RuntimeHealthSummary');
export type RuntimeHealthSummary = z.infer<typeof RuntimeHealthSummarySchema>;

export const PlatformRuntimeSummarySchema = z.object({
  active_sessions: z.number().int(),
  completed_sessions_24h: z.number().int(),
  failed_sessions_24h: z.number().int(),
  call_events_24h: z.number().int(),
  failed_runtime_ingestions_24h: z.number().int(),
  pending_approvals: z.number().int(),
}).openapi('PlatformRuntimeSummary');
export type PlatformRuntimeSummary = z.infer<typeof PlatformRuntimeSummarySchema>;

export const HealthResponseSchema = z.object({
  status: z.string(),
  timestamp: z.string().datetime(),
}).openapi('HealthResponse');
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
