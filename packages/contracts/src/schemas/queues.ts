import { z } from '../registry.js';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const QueueStrategySchema = z.enum(['simultaneous', 'sequential']);
export type QueueStrategy = z.infer<typeof QueueStrategySchema>;

export const QueueStatusSchema = z.enum(['active', 'inactive']);
export type QueueStatus = z.infer<typeof QueueStatusSchema>;

// ── Resource schemas ──────────────────────────────────────────────────────────
export const QueueMemberSchema = z.object({
  id: z.string().uuid(),
  queue_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  extension_id: z.string().uuid(),
  extension_number: z.string(),
  display_name: z.string(),
  position: z.number().int(),
  created_at: z.string().datetime(),
}).openapi('QueueMember');
export type QueueMember = z.infer<typeof QueueMemberSchema>;

export const QueueSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  strategy: QueueStrategySchema,
  ring_timeout_seconds: z.number().int(),
  status: QueueStatusSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('Queue');
export type Queue = z.infer<typeof QueueSchema>;

export const QueueWithMembersSchema = QueueSchema.extend({
  members: z.array(QueueMemberSchema),
}).openapi('QueueWithMembers');
export type QueueWithMembers = z.infer<typeof QueueWithMembersSchema>;

// ── Request schemas ───────────────────────────────────────────────────────────
export const CreateQueueBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  strategy: QueueStrategySchema.optional(),
  ring_timeout_seconds: z.number().int().optional(),
}).openapi('CreateQueueBody');
export type CreateQueueBody = z.infer<typeof CreateQueueBodySchema>;

export const UpdateQueueBodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  strategy: QueueStrategySchema.optional(),
  ring_timeout_seconds: z.number().int().optional(),
  status: QueueStatusSchema.optional(),
}).openapi('UpdateQueueBody');
export type UpdateQueueBody = z.infer<typeof UpdateQueueBodySchema>;

export const AddQueueMemberBodySchema = z.object({
  extension_id: z.string().uuid(),
  position: z.number().int().optional(),
}).openapi('AddQueueMemberBody');
export type AddQueueMemberBody = z.infer<typeof AddQueueMemberBodySchema>;
