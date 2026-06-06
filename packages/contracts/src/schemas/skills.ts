import { z } from '../registry.js';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const SkillStatusSchema = z.enum(['active', 'inactive']);
export type SkillStatus = z.infer<typeof SkillStatusSchema>;

// ── Resource schemas ──────────────────────────────────────────────────────────
export const SkillSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  status: SkillStatusSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('Skill');
export type Skill = z.infer<typeof SkillSchema>;

export const AgentSkillSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  agent_profile_id: z.string().uuid(),
  skill_id: z.string().uuid(),
  skill_name: z.string(),
  proficiency: z.number().int().min(1).max(5),
  created_at: z.string().datetime(),
}).openapi('AgentSkill');
export type AgentSkill = z.infer<typeof AgentSkillSchema>;

export const QueueSkillRequirementSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  queue_id: z.string().uuid(),
  skill_id: z.string().uuid(),
  skill_name: z.string(),
  min_proficiency: z.number().int().min(1).max(5),
  created_at: z.string().datetime(),
}).openapi('QueueSkillRequirement');
export type QueueSkillRequirement = z.infer<typeof QueueSkillRequirementSchema>;

export const RoutingEvaluationSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  queue_id: z.string().uuid(),
  agent_profile_id: z.string().uuid(),
  eligible: z.boolean(),
  reason: z.string(),
  evaluated_at: z.string().datetime(),
}).openapi('RoutingEvaluation');
export type RoutingEvaluation = z.infer<typeof RoutingEvaluationSchema>;

// ── Request schemas ───────────────────────────────────────────────────────────
export const CreateSkillBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
}).openapi('CreateSkillBody');
export type CreateSkillBody = z.infer<typeof CreateSkillBodySchema>;

export const UpdateSkillBodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: SkillStatusSchema.optional(),
}).openapi('UpdateSkillBody');
export type UpdateSkillBody = z.infer<typeof UpdateSkillBodySchema>;

export const AssignAgentSkillBodySchema = z.object({
  skill_id: z.string().uuid(),
  proficiency: z.number().int().min(1).max(5).optional(),
}).openapi('AssignAgentSkillBody');
export type AssignAgentSkillBody = z.infer<typeof AssignAgentSkillBodySchema>;

export const AddQueueSkillRequirementBodySchema = z.object({
  skill_id: z.string().uuid(),
  min_proficiency: z.number().int().min(1).max(5).optional(),
}).openapi('AddQueueSkillRequirementBody');
export type AddQueueSkillRequirementBody = z.infer<typeof AddQueueSkillRequirementBodySchema>;
