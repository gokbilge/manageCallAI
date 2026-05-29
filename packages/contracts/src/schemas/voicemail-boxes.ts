import { z } from '../registry.js';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const VoicemailBoxStatusSchema = z.enum(['active', 'inactive']);
export type VoicemailBoxStatus = z.infer<typeof VoicemailBoxStatusSchema>;

// ── Resource schemas ──────────────────────────────────────────────────────────
export const VoicemailBoxSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  mailbox_number: z.string(),
  greeting_prompt_id: z.string().uuid().nullable(),
  greeting_prompt_name: z.string().nullable(),
  greeting_prompt_uri: z.string().nullable(),
  status: VoicemailBoxStatusSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('VoicemailBox');
export type VoicemailBox = z.infer<typeof VoicemailBoxSchema>;

// ── Request schemas ───────────────────────────────────────────────────────────
export const CreateVoicemailBoxBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  mailbox_number: z.string().min(1),
  greeting_prompt_id: z.string().uuid().nullable().optional(),
}).openapi('CreateVoicemailBoxBody');
export type CreateVoicemailBoxBody = z.infer<typeof CreateVoicemailBoxBodySchema>;

export const UpdateVoicemailBoxBodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  mailbox_number: z.string().min(1).optional(),
  greeting_prompt_id: z.string().uuid().nullable().optional(),
  status: VoicemailBoxStatusSchema.optional(),
}).openapi('UpdateVoicemailBoxBody');
export type UpdateVoicemailBoxBody = z.infer<typeof UpdateVoicemailBoxBodySchema>;
