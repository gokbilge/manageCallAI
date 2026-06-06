import { z } from '../registry.js';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const CrmProviderSchema = z.enum([
  'salesforce',
  'hubspot',
  'zoho',
  'dynamics365',
  'generic_webhook',
]);
export type CrmProvider = z.infer<typeof CrmProviderSchema>;

export const CrmIntegrationStatusSchema = z.enum(['active', 'inactive']);
export type CrmIntegrationStatus = z.infer<typeof CrmIntegrationStatusSchema>;

export const CrmLookupOutcomeSchema = z.enum(['found', 'not_found', 'error']);
export type CrmLookupOutcome = z.infer<typeof CrmLookupOutcomeSchema>;

// ── Resource schemas ──────────────────────────────────────────────────────────
export const CrmIntegrationSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  provider: CrmProviderSchema,
  lookup_url_template: z.string(),
  payload_template: z.record(z.unknown()),
  status: CrmIntegrationStatusSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('CrmIntegration');
export type CrmIntegration = z.infer<typeof CrmIntegrationSchema>;

export const CrmLookupLogSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  crm_integration_id: z.string().uuid(),
  call_uuid: z.string(),
  caller_id: z.string(),
  outcome: CrmLookupOutcomeSchema,
  response_summary: z.string().nullable(),
  error_detail: z.string().nullable(),
  looked_up_at: z.string().datetime(),
}).openapi('CrmLookupLog');
export type CrmLookupLog = z.infer<typeof CrmLookupLogSchema>;

// ── Request schemas ───────────────────────────────────────────────────────────
export const CreateCrmIntegrationBodySchema = z.object({
  name: z.string().min(1),
  provider: CrmProviderSchema,
  lookup_url_template: z.string().min(1),
  payload_template: z.record(z.unknown()).optional(),
}).openapi('CreateCrmIntegrationBody');
export type CreateCrmIntegrationBody = z.infer<typeof CreateCrmIntegrationBodySchema>;

export const UpdateCrmIntegrationBodySchema = z.object({
  name: z.string().min(1).optional(),
  lookup_url_template: z.string().min(1).optional(),
  payload_template: z.record(z.unknown()).optional(),
  status: CrmIntegrationStatusSchema.optional(),
}).openapi('UpdateCrmIntegrationBody');
export type UpdateCrmIntegrationBody = z.infer<typeof UpdateCrmIntegrationBodySchema>;

export const CrmLookupBodySchema = z.object({
  call_uuid: z.string().min(1),
  caller_id: z.string().min(1),
}).openapi('CrmLookupBody');
export type CrmLookupBody = z.infer<typeof CrmLookupBodySchema>;
