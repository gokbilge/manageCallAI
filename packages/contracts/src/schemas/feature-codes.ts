import { z } from '../registry.js';

export const FeatureCodeActionTypeSchema = z.enum([
  'voicemail_access',
  'call_forward_enable',
  'call_forward_disable',
  'dnd_enable',
  'dnd_disable',
  'call_pickup',
  'call_park',
  'call_park_retrieve',
  'conference_join',
]);
export type FeatureCodeActionType = z.infer<typeof FeatureCodeActionTypeSchema>;

export const FeatureCodeStatusSchema = z.enum(['draft', 'active', 'disabled']);
export type FeatureCodeStatus = z.infer<typeof FeatureCodeStatusSchema>;

export const FeatureCodeSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  action_type: FeatureCodeActionTypeSchema,
  action_config: z.record(z.unknown()),
  status: FeatureCodeStatusSchema,
  requires_approval: z.boolean(),
  created_by: z.string().uuid().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  published_at: z.string().datetime().nullable(),
}).openapi('FeatureCode');
export type FeatureCode = z.infer<typeof FeatureCodeSchema>;

export const CreateFeatureCodeBodySchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  action_type: FeatureCodeActionTypeSchema,
  action_config: z.record(z.unknown()).optional(),
  requires_approval: z.boolean().optional(),
}).openapi('CreateFeatureCodeBody');
export type CreateFeatureCodeBody = z.infer<typeof CreateFeatureCodeBodySchema>;

export const UpdateFeatureCodeBodySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  action_type: FeatureCodeActionTypeSchema.optional(),
  action_config: z.record(z.unknown()).optional(),
  requires_approval: z.boolean().optional(),
}).openapi('UpdateFeatureCodeBody');
export type UpdateFeatureCodeBody = z.infer<typeof UpdateFeatureCodeBodySchema>;
