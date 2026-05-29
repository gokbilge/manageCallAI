import { z } from '../registry.js';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const PhoneNumberStatusSchema = z.enum(['active', 'inactive']);
export type PhoneNumberStatus = z.infer<typeof PhoneNumberStatusSchema>;

export const PhoneNumberTargetTypeSchema = z.enum(['inbound_route', 'flow', 'extension']);
export type PhoneNumberTargetType = z.infer<typeof PhoneNumberTargetTypeSchema>;

// ── Resource schemas ──────────────────────────────────────────────────────────
export const PhoneNumberSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  e164_number: z.string(),
  display_label: z.string().nullable(),
  status: PhoneNumberStatusSchema,
  trunk_id: z.string().uuid().nullable(),
  assigned_target_type: PhoneNumberTargetTypeSchema.nullable(),
  assigned_target_id: z.string().uuid().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('PhoneNumber');
export type PhoneNumber = z.infer<typeof PhoneNumberSchema>;

// ── Request schemas ───────────────────────────────────────────────────────────
export const CreatePhoneNumberBodySchema = z.object({
  e164_number: z.string().min(1),
  display_label: z.string().optional(),
  trunk_id: z.string().uuid().optional(),
}).openapi('CreatePhoneNumberBody');
export type CreatePhoneNumberBody = z.infer<typeof CreatePhoneNumberBodySchema>;

export const UpdatePhoneNumberBodySchema = z.object({
  display_label: z.string().nullable().optional(),
  trunk_id: z.string().uuid().nullable().optional(),
  assigned_target_type: PhoneNumberTargetTypeSchema.nullable().optional(),
  assigned_target_id: z.string().uuid().nullable().optional(),
  status: PhoneNumberStatusSchema.optional(),
}).openapi('UpdatePhoneNumberBody');
export type UpdatePhoneNumberBody = z.infer<typeof UpdatePhoneNumberBodySchema>;
