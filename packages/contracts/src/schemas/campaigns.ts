import { z } from '../registry.js';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const CampaignTypeSchema = z.enum(['outbound_preview', 'outbound_progressive']);
export type CampaignType = z.infer<typeof CampaignTypeSchema>;

export const CampaignStatusSchema = z.enum(['draft', 'active', 'paused', 'completed', 'cancelled']);
export type CampaignStatus = z.infer<typeof CampaignStatusSchema>;

export const ContactDialStateSchema = z.enum([
  'pending',
  'dialing',
  'reached',
  'no_answer',
  'failed',
  'skipped',
]);
export type ContactDialState = z.infer<typeof ContactDialStateSchema>;

// ── Resource schemas ──────────────────────────────────────────────────────────
export const CampaignSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  campaign_type: CampaignTypeSchema,
  status: CampaignStatusSchema,
  outbound_route_id: z.string().uuid().nullable(),
  max_concurrent_calls: z.number().int(),
  schedule_start_time: z.string().nullable(),
  schedule_end_time: z.string().nullable(),
  schedule_timezone: z.string(),
  started_at: z.string().datetime().nullable(),
  completed_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('Campaign');
export type Campaign = z.infer<typeof CampaignSchema>;

export const CampaignContactSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  campaign_id: z.string().uuid(),
  phone_number: z.string(),
  display_name: z.string().nullable(),
  context: z.record(z.unknown()),
  dial_state: ContactDialStateSchema,
  attempt_count: z.number().int(),
  last_attempted_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
}).openapi('CampaignContact');
export type CampaignContact = z.infer<typeof CampaignContactSchema>;

export const CampaignAssignmentSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  campaign_id: z.string().uuid(),
  agent_profile_id: z.string().uuid(),
  assigned_at: z.string().datetime(),
}).openapi('CampaignAssignment');
export type CampaignAssignment = z.infer<typeof CampaignAssignmentSchema>;

// ── Request schemas ───────────────────────────────────────────────────────────
export const CreateCampaignBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  campaign_type: CampaignTypeSchema.optional(),
  outbound_route_id: z.string().uuid().nullable().optional(),
  max_concurrent_calls: z.number().int().min(1).max(50).optional(),
  schedule_start_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  schedule_end_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  schedule_timezone: z.string().optional(),
}).openapi('CreateCampaignBody');
export type CreateCampaignBody = z.infer<typeof CreateCampaignBodySchema>;

export const UpdateCampaignBodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  outbound_route_id: z.string().uuid().nullable().optional(),
  max_concurrent_calls: z.number().int().min(1).max(50).optional(),
  schedule_start_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  schedule_end_time: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  schedule_timezone: z.string().optional(),
}).openapi('UpdateCampaignBody');
export type UpdateCampaignBody = z.infer<typeof UpdateCampaignBodySchema>;

export const AddCampaignContactBodySchema = z.object({
  phone_number: z.string().min(1),
  display_name: z.string().optional(),
  context: z.record(z.unknown()).optional(),
}).openapi('AddCampaignContactBody');
export type AddCampaignContactBody = z.infer<typeof AddCampaignContactBodySchema>;

export const AssignCampaignAgentBodySchema = z.object({
  agent_profile_id: z.string().uuid(),
}).openapi('AssignCampaignAgentBody');
export type AssignCampaignAgentBody = z.infer<typeof AssignCampaignAgentBodySchema>;
