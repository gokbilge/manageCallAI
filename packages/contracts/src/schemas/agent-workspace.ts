import { z } from '../registry.js';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const AgentStatusSchema = z.enum(['active', 'inactive']);
export type AgentStatus = z.infer<typeof AgentStatusSchema>;

export const AgentAvailabilityStateSchema = z.enum([
  'available',
  'busy',
  'away',
  'wrap_up',
  'offline',
]);
export type AgentAvailabilityState = z.infer<typeof AgentAvailabilityStateSchema>;

// ── Resource schemas ──────────────────────────────────────────────────────────
export const AgentAvailabilitySchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  agent_profile_id: z.string().uuid(),
  state: AgentAvailabilityStateSchema,
  reason: z.string().nullable(),
  updated_at: z.string().datetime(),
}).openapi('AgentAvailability');
export type AgentAvailability = z.infer<typeof AgentAvailabilitySchema>;

export const AgentProfileSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid(),
  display_name: z.string(),
  max_concurrent_calls: z.number().int(),
  status: AgentStatusSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('AgentProfile');
export type AgentProfile = z.infer<typeof AgentProfileSchema>;

export const AgentProfileWithAvailabilitySchema = AgentProfileSchema.extend({
  availability: AgentAvailabilitySchema.nullable(),
}).openapi('AgentProfileWithAvailability');
export type AgentProfileWithAvailability = z.infer<typeof AgentProfileWithAvailabilitySchema>;

// ── Request schemas ───────────────────────────────────────────────────────────
export const CreateAgentProfileBodySchema = z.object({
  user_id: z.string().uuid(),
  display_name: z.string().min(1),
  max_concurrent_calls: z.number().int().min(1).max(10).optional(),
}).openapi('CreateAgentProfileBody');
export type CreateAgentProfileBody = z.infer<typeof CreateAgentProfileBodySchema>;

export const UpdateAgentProfileBodySchema = z.object({
  display_name: z.string().min(1).optional(),
  max_concurrent_calls: z.number().int().min(1).max(10).optional(),
  status: AgentStatusSchema.optional(),
}).openapi('UpdateAgentProfileBody');
export type UpdateAgentProfileBody = z.infer<typeof UpdateAgentProfileBodySchema>;

export const SetAgentAvailabilityBodySchema = z.object({
  state: AgentAvailabilityStateSchema,
  reason: z.string().nullable().optional(),
}).openapi('SetAgentAvailabilityBody');
export type SetAgentAvailabilityBody = z.infer<typeof SetAgentAvailabilityBodySchema>;
