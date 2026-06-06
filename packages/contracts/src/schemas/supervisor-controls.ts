import { z } from '../registry.js';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const SupervisorControlTypeSchema = z.enum(['monitor', 'whisper', 'barge']);
export type SupervisorControlType = z.infer<typeof SupervisorControlTypeSchema>;

export const SupervisorControlStatusSchema = z.enum(['pending', 'active', 'ended']);
export type SupervisorControlStatus = z.infer<typeof SupervisorControlStatusSchema>;

// ── Resource schemas ──────────────────────────────────────────────────────────
export const SupervisorControlSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  supervisor_user_id: z.string().uuid(),
  control_type: SupervisorControlTypeSchema,
  target_call_id: z.string(),
  status: SupervisorControlStatusSchema,
  audit_note: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  ended_at: z.string().datetime().nullable(),
}).openapi('SupervisorControl');
export type SupervisorControl = z.infer<typeof SupervisorControlSchema>;

// ── Request schemas ───────────────────────────────────────────────────────────
export const CreateSupervisorControlBodySchema = z.object({
  control_type: SupervisorControlTypeSchema,
  target_call_id: z.string().min(1),
  audit_note: z.string().nullable().optional(),
}).openapi('CreateSupervisorControlBody');
export type CreateSupervisorControlBody = z.infer<typeof CreateSupervisorControlBodySchema>;

export const UpdateSupervisorControlBodySchema = z.object({
  status: SupervisorControlStatusSchema.optional(),
  audit_note: z.string().nullable().optional(),
}).openapi('UpdateSupervisorControlBody');
export type UpdateSupervisorControlBody = z.infer<typeof UpdateSupervisorControlBodySchema>;
