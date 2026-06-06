import { z } from '../registry.js';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const CallbackStatusSchema = z.enum([
  'pending',
  'scheduled',
  'calling',
  'reached',
  'cancelled',
  'expired',
]);
export type CallbackStatus = z.infer<typeof CallbackStatusSchema>;

// ── Resource schemas ──────────────────────────────────────────────────────────
export const QueueCallbackSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  queue_id: z.string().uuid(),
  caller_phone: z.string(),
  caller_name: z.string().nullable(),
  scheduled_at: z.string().datetime().nullable(),
  retry_count: z.number().int(),
  max_retries: z.number().int(),
  status: CallbackStatusSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('QueueCallback');
export type QueueCallback = z.infer<typeof QueueCallbackSchema>;

// ── Request schemas ───────────────────────────────────────────────────────────
export const CreateQueueCallbackBodySchema = z.object({
  caller_phone: z.string().min(1),
  caller_name: z.string().nullable().optional(),
  scheduled_at: z.string().datetime().nullable().optional(),
  max_retries: z.number().int().min(0).max(10).optional(),
}).openapi('CreateQueueCallbackBody');
export type CreateQueueCallbackBody = z.infer<typeof CreateQueueCallbackBodySchema>;

export const UpdateQueueCallbackBodySchema = z.object({
  status: CallbackStatusSchema.optional(),
  scheduled_at: z.string().datetime().nullable().optional(),
  caller_name: z.string().nullable().optional(),
}).openapi('UpdateQueueCallbackBody');
export type UpdateQueueCallbackBody = z.infer<typeof UpdateQueueCallbackBodySchema>;
