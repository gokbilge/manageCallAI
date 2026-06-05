import { z } from '../registry.js';

export const ReportFilterSchema = z.object({
  dimension: z.string(),
  value: z.string(),
}).openapi('ReportFilter');
export type ReportFilter = z.infer<typeof ReportFilterSchema>;

export const ReportCallRowSchema = z.object({
  call_id: z.string(),
  event_type: z.string(),
  event_time: z.string().datetime(),
  source: z.string().nullable(),
}).openapi('ReportCallRow');
export type ReportCallRow = z.infer<typeof ReportCallRowSchema>;

export const NlQueryResultSchema = z.object({
  question: z.string(),
  applied_filters: z.array(ReportFilterSchema),
  explanation: z.string(),
  result_count: z.number().int(),
  results: z.array(ReportCallRowSchema),
  is_advisory: z.literal(true),
  queried_at: z.string().datetime(),
}).openapi('NlQueryResult');
export type NlQueryResult = z.infer<typeof NlQueryResultSchema>;

export const NlQueryRequestSchema = z.object({
  question: z.string().min(1).max(500),
}).openapi('NlQueryRequest');
export type NlQueryRequest = z.infer<typeof NlQueryRequestSchema>;
