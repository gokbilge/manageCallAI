import { z } from '../registry.js';

// ── Resource schemas ──────────────────────────────────────────────────────────
export const CallEventSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  call_id: z.string(),
  event_type: z.string(),
  event_time: z.string().datetime(),
  source: z.string().nullable(),
  payload: z.record(z.unknown()),
  ingested_at: z.string().datetime(),
}).openapi('CallEvent');
export type CallEvent = z.infer<typeof CallEventSchema>;

// ── Request schemas ───────────────────────────────────────────────────────────
export const IngestCallEventBodySchema = z.object({
  tenant_id: z.string().min(1),
  call_id: z.string().min(1),
  event_type: z.string().min(1),
  event_time: z.string().datetime().optional(),
  source: z.string().optional(),
  payload: z.record(z.unknown()).optional(),
}).openapi('IngestCallEventBody');
export type IngestCallEventBody = z.infer<typeof IngestCallEventBodySchema>;
