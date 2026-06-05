import { z } from '../registry.js';

export const RiskTargetTypeSchema = z.enum(['outbound_route', 'inbound_route', 'sip_trunk']);
export type RiskTargetType = z.infer<typeof RiskTargetTypeSchema>;

export const RiskLevelSchema = z.enum(['low', 'medium', 'high']);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const RiskConcernSeveritySchema = z.enum(['info', 'warning', 'error']);
export type RiskConcernSeverity = z.infer<typeof RiskConcernSeveritySchema>;

export const RiskConcernSchema = z.object({
  code: z.string(),
  severity: RiskConcernSeveritySchema,
  message: z.string(),
}).openapi('RiskConcern');
export type RiskConcern = z.infer<typeof RiskConcernSchema>;

export const AffectedObjectSchema = z.object({
  type: z.string(),
  id: z.string().uuid(),
  name: z.string(),
  role: z.string(),
}).openapi('AffectedObject');
export type AffectedObject = z.infer<typeof AffectedObjectSchema>;

export const RouteRiskAnalysisSchema = z.object({
  target_type: RiskTargetTypeSchema,
  target_id: z.string().uuid(),
  target_name: z.string(),
  target_status: z.string(),
  risk_level: RiskLevelSchema,
  affected_objects: z.array(AffectedObjectSchema),
  unresolved_concerns: z.array(RiskConcernSchema),
  summary: z.string(),
  is_advisory: z.literal(true),
  analyzed_at: z.string().datetime(),
}).openapi('RouteRiskAnalysis');
export type RouteRiskAnalysis = z.infer<typeof RouteRiskAnalysisSchema>;

export const RouteRiskAnalysisRequestSchema = z.object({
  target_type: RiskTargetTypeSchema,
  target_id: z.string().uuid(),
}).openapi('RouteRiskAnalysisRequest');
export type RouteRiskAnalysisRequest = z.infer<typeof RouteRiskAnalysisRequestSchema>;
