import { z } from '../registry.js';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const CallGroupStrategySchema = z.enum(['simultaneous', 'sequential']);
export type CallGroupStrategy = z.infer<typeof CallGroupStrategySchema>;

export const CallGroupStatusSchema = z.enum(['active', 'inactive']);
export type CallGroupStatus = z.infer<typeof CallGroupStatusSchema>;

// ── Resource schemas ──────────────────────────────────────────────────────────
export const CallGroupMemberSchema = z.object({
  id: z.string().uuid(),
  call_group_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  extension_id: z.string().uuid(),
  extension_number: z.string(),
  display_name: z.string(),
  position: z.number().int(),
  created_at: z.string().datetime(),
}).openapi('CallGroupMember');
export type CallGroupMember = z.infer<typeof CallGroupMemberSchema>;

export const CallGroupSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  strategy: CallGroupStrategySchema,
  status: CallGroupStatusSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('CallGroup');
export type CallGroup = z.infer<typeof CallGroupSchema>;

export const CallGroupWithMembersSchema = CallGroupSchema.extend({
  members: z.array(CallGroupMemberSchema),
}).openapi('CallGroupWithMembers');
export type CallGroupWithMembers = z.infer<typeof CallGroupWithMembersSchema>;

// ── Request schemas ───────────────────────────────────────────────────────────
export const CreateCallGroupBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  strategy: CallGroupStrategySchema.optional(),
}).openapi('CreateCallGroupBody');
export type CreateCallGroupBody = z.infer<typeof CreateCallGroupBodySchema>;

export const UpdateCallGroupBodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  strategy: CallGroupStrategySchema.optional(),
  status: CallGroupStatusSchema.optional(),
}).openapi('UpdateCallGroupBody');
export type UpdateCallGroupBody = z.infer<typeof UpdateCallGroupBodySchema>;

export const AddCallGroupMemberBodySchema = z.object({
  extension_id: z.string().uuid(),
  position: z.number().int().optional(),
}).openapi('AddCallGroupMemberBody');
export type AddCallGroupMemberBody = z.infer<typeof AddCallGroupMemberBodySchema>;
