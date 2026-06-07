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

export const EnterpriseConflictSeveritySchema = z.enum(['info', 'warning', 'error']);
export type EnterpriseConflictSeverity = z.infer<typeof EnterpriseConflictSeveritySchema>;

export const EnterpriseConflictScopeSchema = z.enum([
  'route',
  'site',
  'numbering_plan',
  'calling_policy',
  'schedule',
  'trunk_group',
  'failover',
]);
export type EnterpriseConflictScope = z.infer<typeof EnterpriseConflictScopeSchema>;

export const EnterpriseConflictSchema = z.object({
  code: z.string(),
  severity: EnterpriseConflictSeveritySchema,
  scope: EnterpriseConflictScopeSchema,
  message: z.string(),
}).openapi('EnterpriseConflict');
export type EnterpriseConflict = z.infer<typeof EnterpriseConflictSchema>;

export const EnterpriseValidationReportSchema = z.object({
  target_type: z.literal('outbound_route'),
  target_id: z.string().uuid(),
  target_name: z.string(),
  validation_status: z.enum(['passed', 'failed']),
  blocking_issues: z.array(EnterpriseConflictSchema),
  advisory_issues: z.array(EnterpriseConflictSchema),
  checked_at: z.string().datetime(),
  summary: z.string(),
}).openapi('EnterpriseValidationReport');
export type EnterpriseValidationReport = z.infer<typeof EnterpriseValidationReportSchema>;

export const EnterpriseSimulationStepSchema = z.object({
  category: z.enum(['site', 'schedule', 'numbering', 'policy', 'route', 'failover']),
  status: z.enum(['ok', 'warning', 'blocked']),
  title: z.string(),
  detail: z.string(),
}).openapi('EnterpriseSimulationStep');
export type EnterpriseSimulationStep = z.infer<typeof EnterpriseSimulationStepSchema>;

export const EnterpriseSimulationReportSchema = z.object({
  target_type: z.literal('outbound_route'),
  target_id: z.string().uuid(),
  dial_string: z.string(),
  site_id: z.string().uuid().nullable(),
  site_name: z.string().nullable(),
  schedule_id: z.string().uuid().nullable(),
  schedule_name: z.string().nullable(),
  call_type: z.enum(['local', 'national', 'mobile', 'international', 'premium_rate', 'emergency', 'toll_free', 'special']).nullable(),
  matched_rule_name: z.string().nullable(),
  policy_name: z.string().nullable(),
  schedule_state: z.enum(['in_hours', 'out_of_hours', 'not_checked', 'missing']),
  outcome: z.enum(['routed_primary', 'routed_fallback', 'blocked_by_policy', 'out_of_hours', 'no_available_trunks', 'schedule_missing']),
  selected_trunk_id: z.string().uuid().nullable(),
  selected_trunk_name: z.string().nullable(),
  steps: z.array(EnterpriseSimulationStepSchema),
  summary: z.string(),
  is_advisory: z.literal(true),
  simulated_at: z.string().datetime(),
}).openapi('EnterpriseSimulationReport');
export type EnterpriseSimulationReport = z.infer<typeof EnterpriseSimulationReportSchema>;

export const OutboundRouteEnterpriseCheckSchema = z.object({
  validation: EnterpriseValidationReportSchema,
  simulation: EnterpriseSimulationReportSchema,
}).openapi('OutboundRouteEnterpriseCheck');
export type OutboundRouteEnterpriseCheck = z.infer<typeof OutboundRouteEnterpriseCheckSchema>;

export const OutboundRouteEnterpriseCheckBodySchema = z.object({
  dial_string: z.string().min(1).optional(),
  site_id: z.string().uuid().nullable().optional(),
  schedule_id: z.string().uuid().nullable().optional(),
  at: z.string().datetime().nullable().optional(),
}).openapi('OutboundRouteEnterpriseCheckBody');
export type OutboundRouteEnterpriseCheckBody = z.infer<typeof OutboundRouteEnterpriseCheckBodySchema>;
