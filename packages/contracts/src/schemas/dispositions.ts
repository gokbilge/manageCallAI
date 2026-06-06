import { z } from '../registry.js';

// ── Resource schemas ──────────────────────────────────────────────────────────
export const DispositionCodeSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  code: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  queue_id: z.string().uuid().nullable(),
  is_active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('DispositionCode');
export type DispositionCode = z.infer<typeof DispositionCodeSchema>;

export const CallDispositionSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  call_id: z.string(),
  disposition_code_id: z.string().uuid(),
  code: z.string(),
  label: z.string(),
  agent_profile_id: z.string().uuid().nullable(),
  recorded_by: z.string().uuid(),
  note: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('CallDisposition');
export type CallDisposition = z.infer<typeof CallDispositionSchema>;

export const CallNoteSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  call_id: z.string(),
  author_user_id: z.string().uuid(),
  content: z.string(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('CallNote');
export type CallNote = z.infer<typeof CallNoteSchema>;

// ── Request schemas ───────────────────────────────────────────────────────────
export const CreateDispositionCodeBodySchema = z.object({
  code: z.string().min(1).max(64).regex(/^[A-Z0-9_]+$/),
  label: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  queue_id: z.string().uuid().nullable().optional(),
}).openapi('CreateDispositionCodeBody');
export type CreateDispositionCodeBody = z.infer<typeof CreateDispositionCodeBodySchema>;

export const UpdateDispositionCodeBodySchema = z.object({
  label: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  queue_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean().optional(),
}).openapi('UpdateDispositionCodeBody');
export type UpdateDispositionCodeBody = z.infer<typeof UpdateDispositionCodeBodySchema>;

export const RecordDispositionBodySchema = z.object({
  disposition_code_id: z.string().uuid(),
  agent_profile_id: z.string().uuid().nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
}).openapi('RecordDispositionBody');
export type RecordDispositionBody = z.infer<typeof RecordDispositionBodySchema>;

export const CreateCallNoteBodySchema = z.object({
  content: z.string().min(1).max(5000),
}).openapi('CreateCallNoteBody');
export type CreateCallNoteBody = z.infer<typeof CreateCallNoteBodySchema>;

export const UpdateCallNoteBodySchema = z.object({
  content: z.string().min(1).max(5000),
}).openapi('UpdateCallNoteBody');
export type UpdateCallNoteBody = z.infer<typeof UpdateCallNoteBodySchema>;
