import { z } from '../registry.js';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const PromptAssetStatusSchema = z.enum(['active', 'inactive']);
export type PromptAssetStatus = z.infer<typeof PromptAssetStatusSchema>;

// ── Resource schemas ──────────────────────────────────────────────────────────
export const PromptAssetSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  media_type: z.string(),
  language: z.string().nullable(),
  storage_uri: z.string().nullable(),
  checksum: z.string().nullable(),
  status: PromptAssetStatusSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('PromptAsset');
export type PromptAsset = z.infer<typeof PromptAssetSchema>;

// ── Request schemas ───────────────────────────────────────────────────────────
export const CreatePromptAssetBodySchema = z.object({
  name: z.string().min(1),
  media_type: z.string().min(1),
  language: z.string().optional(),
  storage_uri: z.string().min(1),
  checksum: z.string().optional(),
}).openapi('CreatePromptAssetBody');
export type CreatePromptAssetBody = z.infer<typeof CreatePromptAssetBodySchema>;

export const UpdatePromptAssetBodySchema = z.object({
  name: z.string().min(1).optional(),
  media_type: z.string().min(1).optional(),
  language: z.string().nullable().optional(),
  storage_uri: z.string().nullable().optional(),
  checksum: z.string().nullable().optional(),
  status: PromptAssetStatusSchema.optional(),
}).openapi('UpdatePromptAssetBody');
export type UpdatePromptAssetBody = z.infer<typeof UpdatePromptAssetBodySchema>;
