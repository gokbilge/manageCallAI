import { z } from '../registry.js';

export const RuntimeApplyActionTypeSchema = z.enum([
  'reloadxml',
  'sofia_profile_rescan',
  'sofia_profile_killgw',
  'sofia_profile_restartgw',
  'sofia_status_gateway',
  'sofia_status_profile',
]);
export type RuntimeApplyActionType = z.infer<typeof RuntimeApplyActionTypeSchema>;

export const RuntimeApplyStatusSchema = z.enum([
  'pending', 'applying', 'applied', 'failed', 'cancelled',
]);
export type RuntimeApplyStatus = z.infer<typeof RuntimeApplyStatusSchema>;

export const RuntimeApplyRequestSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid().nullable(),
  triggered_by_type: z.enum(['user', 'workflow', 'system']),
  triggered_by_id: z.string().uuid().nullable(),
  action_type: RuntimeApplyActionTypeSchema,
  target_node_id: z.string().uuid(),
  target_profile: z.string().nullable(),
  target_gateway: z.string().nullable(),
  object_type: z.string(),
  object_id: z.string().uuid(),
  status: RuntimeApplyStatusSchema,
  active_call_count: z.number().int().nullable(),
  applied_at: z.string().datetime().nullable(),
  error_message: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('RuntimeApplyRequest');
export type RuntimeApplyRequest = z.infer<typeof RuntimeApplyRequestSchema>;
