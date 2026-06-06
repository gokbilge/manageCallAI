import { z } from '../registry.js';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const ApprovalStatusSchema = z.enum(['pending', 'approved', 'rejected', 'expired']);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

// ── Resource schemas ──────────────────────────────────────────────────────────
export const ApprovalRequestSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  object_type: z.string(),
  object_id: z.string().uuid(),
  version_id: z.string().uuid().nullable(),
  requested_by: z.string().uuid().nullable(),
  status: ApprovalStatusSchema,
  created_at: z.string().datetime(),
  metadata: z.record(z.unknown()),
}).openapi('ApprovalRequest');
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;

export const ApprovalRequestWithDetailsSchema = ApprovalRequestSchema.extend({
  flow_name: z.string().nullable(),
  action_type: z.enum(['publish', 'rollback']).nullable(),
}).openapi('ApprovalRequestWithDetails');
export type ApprovalRequestWithDetails = z.infer<typeof ApprovalRequestWithDetailsSchema>;

export const PolicySchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  policy_type: z.string(),
  status: z.string(),
  rules: z.record(z.unknown()),
  created_at: z.string().datetime(),
}).openapi('Policy');
export type Policy = z.infer<typeof PolicySchema>;

export const ApprovalDecisionResultSchema = z.object({
  approval_request: ApprovalRequestWithDetailsSchema,
  action_type: z.enum(['publish', 'rollback']),
  publish_result: z.literal('success').optional(),
}).openapi('ApprovalDecisionResult');
export type ApprovalDecisionResult = z.infer<typeof ApprovalDecisionResultSchema>;

// ── Request schemas ───────────────────────────────────────────────────────────
export const ApprovalDecisionBodySchema = z.object({
  decision: z.enum(['approved', 'rejected']),
}).openapi('ApprovalDecisionBody');
export type ApprovalDecisionBody = z.infer<typeof ApprovalDecisionBodySchema>;
