import { z } from '../registry.js';

export const InvestigationCitationSourceSchema = z.enum([
  'call_event',
  'inbound_route',
  'outbound_route',
  'sip_trunk',
  'recording',
  'gateway_status',
]);
export type InvestigationCitationSource = z.infer<typeof InvestigationCitationSourceSchema>;

export const InvestigationCitationSchema = z.object({
  source: InvestigationCitationSourceSchema,
  id: z.string().min(1),
  label: z.string().min(1),
  fact: z.string().min(1),
}).openapi('InvestigationCitation');
export type InvestigationCitation = z.infer<typeof InvestigationCitationSchema>;

export const InvestigationContextTimeRangeSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
}).openapi('InvestigationContextTimeRange');
export type InvestigationContextTimeRange = z.infer<typeof InvestigationContextTimeRangeSchema>;

export const InvestigationContextSchema = z.object({
  call_ids: z.array(z.string().min(1)).max(25).optional(),
  route_ids: z.array(z.string().uuid()).max(25).optional(),
  time_range: InvestigationContextTimeRangeSchema.optional(),
}).openapi('InvestigationContext');
export type InvestigationContext = z.infer<typeof InvestigationContextSchema>;

export const IncidentInvestigationSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  question: z.string().min(1).max(2000),
  context: InvestigationContextSchema,
  answer: z.string().nullable(),
  citations: z.array(InvestigationCitationSchema),
  data_sources: z.array(z.string().min(1)),
  is_advisory: z.literal(true),
  created_by: z.string().uuid().nullable(),
  created_at: z.string().datetime(),
}).openapi('IncidentInvestigation');
export type IncidentInvestigation = z.infer<typeof IncidentInvestigationSchema>;

export const CreateIncidentInvestigationBodySchema = z.object({
  question: z.string().min(1).max(2000),
  context: InvestigationContextSchema.optional(),
}).openapi('CreateIncidentInvestigationBody');
export type CreateIncidentInvestigationBody = z.infer<typeof CreateIncidentInvestigationBodySchema>;
