import { z } from '../registry.js';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const RouteVersionStateSchema = z.enum([
  'draft',
  'validated',
  'simulated',
  'published',
  'superseded',
  'rolled_back',
]);
export type RouteVersionState = z.infer<typeof RouteVersionStateSchema>;

export const InboundRouteMatchTypeSchema = z.enum(['did', 'trunk', 'pattern']);
export type InboundRouteMatchType = z.infer<typeof InboundRouteMatchTypeSchema>;
export const INBOUND_ROUTE_MATCH_VALUE_MAX_LENGTH = 200;

export const InboundRouteTargetTypeSchema = z.enum([
  'flow',
  'extension',
  'call_group',
  'queue',
  'voicemail_box',
]);
export type InboundRouteTargetType = z.infer<typeof InboundRouteTargetTypeSchema>;

export const InboundRouteStatusSchema = z.enum(['draft', 'active', 'inactive']);
export type InboundRouteStatus = z.infer<typeof InboundRouteStatusSchema>;

// ── Resource schemas ──────────────────────────────────────────────────────────
export const RouteVersionSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  route_type: z.literal('inbound'),
  route_id: z.string().uuid(),
  version_number: z.number().int(),
  state: RouteVersionStateSchema,
  definition: z.record(z.unknown()),
  created_by: z.string().uuid().nullable(),
  created_at: z.string().datetime(),
  validated_at: z.string().datetime().nullable(),
  published_at: z.string().datetime().nullable(),
}).openapi('RouteVersion');
export type RouteVersion = z.infer<typeof RouteVersionSchema>;

export const InboundRouteSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  match_type: InboundRouteMatchTypeSchema,
  match_value: z.string(),
  phone_number_id: z.string().uuid().nullable(),
  target_type: InboundRouteTargetTypeSchema,
  target_id: z.string().uuid().nullable(),
  status: InboundRouteStatusSchema,
  draft_version_id: z.string().uuid().nullable(),
  active_version_id: z.string().uuid().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('InboundRoute');
export type InboundRoute = z.infer<typeof InboundRouteSchema>;

export const InboundRouteWithVersionsSchema = InboundRouteSchema.extend({
  versions: z.array(RouteVersionSchema),
}).openapi('InboundRouteWithVersions');
export type InboundRouteWithVersions = z.infer<typeof InboundRouteWithVersionsSchema>;

export const ValidationErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
}).openapi('ValidationError');
export type ValidationError = z.infer<typeof ValidationErrorSchema>;

export const ValidationOutcomeSchema = z.object({
  status: z.enum(['passed', 'failed']),
  errors: z.array(ValidationErrorSchema),
  warnings: z.array(ValidationErrorSchema),
}).openapi('ValidationOutcome');
export type ValidationOutcome = z.infer<typeof ValidationOutcomeSchema>;

// ── Request schemas ───────────────────────────────────────────────────────────
export const CreateInboundRouteBodySchema = z.object({
  name: z.string().min(1),
  match_type: InboundRouteMatchTypeSchema,
  match_value: z.string().min(1).max(INBOUND_ROUTE_MATCH_VALUE_MAX_LENGTH),
  phone_number_id: z.string().uuid().nullable().optional(),
  target_type: InboundRouteTargetTypeSchema,
  target_id: z.string().uuid().optional(),
}).openapi('CreateInboundRouteBody');
export type CreateInboundRouteBody = z.infer<typeof CreateInboundRouteBodySchema>;

export const UpdateInboundRouteBodySchema = z.object({
  name: z.string().min(1).optional(),
  match_type: InboundRouteMatchTypeSchema.optional(),
  match_value: z.string().min(1).max(INBOUND_ROUTE_MATCH_VALUE_MAX_LENGTH).optional(),
  phone_number_id: z.string().uuid().nullable().optional(),
  target_type: InboundRouteTargetTypeSchema.optional(),
  target_id: z.string().uuid().nullable().optional(),
}).openapi('UpdateInboundRouteBody');
export type UpdateInboundRouteBody = z.infer<typeof UpdateInboundRouteBodySchema>;
