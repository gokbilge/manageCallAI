import { z } from '../registry.js';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const ExtensionStatusSchema = z.enum(['active', 'inactive']);
export type ExtensionStatus = z.infer<typeof ExtensionStatusSchema>;

export const DestinationTypeSchema = z.enum(['flow', 'extension', 'user', 'queue']);
export type DestinationType = z.infer<typeof DestinationTypeSchema>;

// ── Resource schemas ──────────────────────────────────────────────────────────
export const ExtensionSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  extension_number: z.string(),
  display_name: z.string(),
  status: ExtensionStatusSchema,
  sip_username: z.string(),
  default_destination_type: DestinationTypeSchema.nullable(),
  default_destination_id: z.string().uuid().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('Extension');
export type Extension = z.infer<typeof ExtensionSchema>;

// ── Request schemas ───────────────────────────────────────────────────────────
export const CreateExtensionBodySchema = z.object({
  extension_number: z.string().min(1).max(20),
  display_name: z.string().min(1).max(255),
  sip_username: z.string().min(1).max(64).optional(),
  sip_password: z.string().min(8).max(128),
  default_destination_type: DestinationTypeSchema.optional(),
  default_destination_id: z.string().uuid().optional(),
}).openapi('CreateExtensionBody');
export type CreateExtensionBody = z.infer<typeof CreateExtensionBodySchema>;

export const UpdateExtensionBodySchema = z.object({
  extension_number: z.string().min(1).max(20).optional(),
  display_name: z.string().min(1).max(255).optional(),
  status: ExtensionStatusSchema.optional(),
  sip_username: z.string().min(1).max(64).optional(),
  sip_password: z.string().min(8).max(128).optional(),
  default_destination_type: DestinationTypeSchema.nullable().optional(),
  default_destination_id: z.string().uuid().nullable().optional(),
}).openapi('UpdateExtensionBody');
export type UpdateExtensionBody = z.infer<typeof UpdateExtensionBodySchema>;
