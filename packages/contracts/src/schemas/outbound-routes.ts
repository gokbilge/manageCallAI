import { z } from '../registry.js';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const OutboundRouteStatusSchema = z.enum(['draft', 'active', 'inactive']);
export type OutboundRouteStatus = z.infer<typeof OutboundRouteStatusSchema>;

// ── Resource schemas ──────────────────────────────────────────────────────────
export const OutboundRouteSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  status: OutboundRouteStatusSchema,
  match_prefix: z.string(),
  priority: z.number().int(),
  sip_trunk_id: z.string().uuid(),
  fallback_sip_trunk_id: z.string().uuid().nullable(),
  max_calls_per_minute: z.number().int().nullable(),
  allowed_caller_id_numbers_json: z.array(z.string()).nullable(),
  allowed_destination_prefixes_json: z.array(z.string()).nullable(),
  blocked_destination_prefixes_json: z.array(z.string()).nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('OutboundRoute');
export type OutboundRoute = z.infer<typeof OutboundRouteSchema>;

export const ResolvedOutboundRouteSchema = z.object({
  route_id: z.string().uuid(),
  sip_trunk_id: z.string().uuid(),
  fallback_sip_trunk_id: z.string().uuid().nullable(),
  match_prefix: z.string(),
  priority: z.number().int(),
  allowed_destination_prefixes_json: z.array(z.string()).nullable(),
  blocked_destination_prefixes_json: z.array(z.string()).nullable(),
}).openapi('ResolvedOutboundRoute');
export type ResolvedOutboundRoute = z.infer<typeof ResolvedOutboundRouteSchema>;

// ── Request schemas ───────────────────────────────────────────────────────────
export const CreateOutboundRouteBodySchema = z.object({
  name: z.string().min(1),
  match_prefix: z.string().min(1),
  priority: z.number().int().optional(),
  sip_trunk_id: z.string().uuid(),
  fallback_sip_trunk_id: z.string().uuid().nullable().optional(),
  max_calls_per_minute: z.number().int().nullable().optional(),
  allowed_caller_id_numbers_json: z.array(z.string()).nullable().optional(),
  allowed_destination_prefixes_json: z.array(z.string()).nullable().optional(),
  blocked_destination_prefixes_json: z.array(z.string()).nullable().optional(),
  start_as_draft: z.boolean().optional(),
}).openapi('CreateOutboundRouteBody');
export type CreateOutboundRouteBody = z.infer<typeof CreateOutboundRouteBodySchema>;

export const UpdateOutboundRouteBodySchema = z.object({
  name: z.string().min(1).optional(),
  match_prefix: z.string().min(1).optional(),
  priority: z.number().int().optional(),
  sip_trunk_id: z.string().uuid().optional(),
  fallback_sip_trunk_id: z.string().uuid().nullable().optional(),
  max_calls_per_minute: z.number().int().nullable().optional(),
  allowed_caller_id_numbers_json: z.array(z.string()).nullable().optional(),
  allowed_destination_prefixes_json: z.array(z.string()).nullable().optional(),
  blocked_destination_prefixes_json: z.array(z.string()).nullable().optional(),
  status: OutboundRouteStatusSchema.optional(),
}).openapi('UpdateOutboundRouteBody');
export type UpdateOutboundRouteBody = z.infer<typeof UpdateOutboundRouteBodySchema>;

export const ResolveOutboundRouteBodySchema = z.object({
  tenant_id: z.string().min(1),
  dial_number: z.string().min(1),
}).openapi('ResolveOutboundRouteBody');
export type ResolveOutboundRouteBody = z.infer<typeof ResolveOutboundRouteBodySchema>;
