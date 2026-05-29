import { z } from '../registry.js';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const MeetingSessionStatusSchema = z.enum([
  'scheduled',
  'active',
  'completed',
  'failed',
]);
export type MeetingSessionStatus = z.infer<typeof MeetingSessionStatusSchema>;

// ── Resource schemas ──────────────────────────────────────────────────────────
export const MeetingSessionSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  channel_account_id: z.string().uuid(),
  meeting_code: z.string().nullable(),
  meeting_url: z.string().nullable(),
  status: MeetingSessionStatusSchema,
  participant_count: z.number().int(),
  recording_reference: z.string().nullable(),
  transcript_reference: z.string().nullable(),
  provider_metadata: z.record(z.unknown()),
  started_at: z.string().datetime().nullable(),
  ended_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('MeetingSession');
export type MeetingSession = z.infer<typeof MeetingSessionSchema>;

// ── Request schemas ───────────────────────────────────────────────────────────
export const CreateMeetingSessionBodySchema = z.object({
  channel_account_id: z.string().uuid(),
  meeting_code: z.string().optional(),
  meeting_url: z.string().optional(),
  provider_metadata: z.record(z.unknown()).optional(),
}).openapi('CreateMeetingSessionBody');
export type CreateMeetingSessionBody = z.infer<typeof CreateMeetingSessionBodySchema>;

export const UpdateMeetingSessionBodySchema = z.object({
  status: MeetingSessionStatusSchema.optional(),
  meeting_url: z.string().optional(),
  participant_count: z.number().int().optional(),
  recording_reference: z.string().optional(),
  transcript_reference: z.string().optional(),
  provider_metadata: z.record(z.unknown()).optional(),
  started_at: z.string().datetime().optional(),
  ended_at: z.string().datetime().optional(),
}).openapi('UpdateMeetingSessionBody');
export type UpdateMeetingSessionBody = z.infer<typeof UpdateMeetingSessionBodySchema>;
