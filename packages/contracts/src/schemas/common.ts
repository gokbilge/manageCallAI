import { z } from '../registry.js';

// ── Error response ────────────────────────────────────────────────────────────
export const ErrorCodeSchema = z.enum([
  'NOT_FOUND',
  'INVALID_ARGUMENT',
  'UNAUTHENTICATED',
  'PERMISSION_DENIED',
  'ALREADY_EXISTS',
  'CONFLICT',
  'FAILED_PRECONDITION',
  'RESOURCE_EXHAUSTED',
  'INTERNAL',
  'UNAVAILABLE',
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ErrorResponseSchema = z.object({
  error: ErrorCodeSchema,
  message: z.string(),
  request_id: z.string(),
}).openapi('ErrorResponse');
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// ── Generic data wrapper ──────────────────────────────────────────────────────
export const DataResponseSchema = z.object({
  data: z.unknown(),
}).openapi('DataResponse');
export type DataResponse = z.infer<typeof DataResponseSchema>;

// ── Common route param/query schemas ──────────────────────────────────────────
export const UuidParamsSchema = z.object({
  id: z.string().uuid(),
});
export type UuidParams = z.infer<typeof UuidParamsSchema>;

export const IdParamsSchema = z.object({
  id: z.string(),
});
export type IdParams = z.infer<typeof IdParamsSchema>;
