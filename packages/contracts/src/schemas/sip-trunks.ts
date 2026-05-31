import { z } from '../registry.js';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const SipTrunkStatusSchema = z.enum(['active', 'inactive']);
export type SipTrunkStatus = z.infer<typeof SipTrunkStatusSchema>;

export const SipTrunkDirectionSchema = z.enum(['inbound', 'outbound', 'bidirectional']);
export type SipTrunkDirection = z.infer<typeof SipTrunkDirectionSchema>;

export const SipTrunkTransportSchema = z.enum(['udp', 'tcp', 'tls']);
export type SipTrunkTransport = z.infer<typeof SipTrunkTransportSchema>;

export const SipTrunkDtmfModeSchema = z.enum(['rfc2833', 'info', 'inband', 'auto']);
export type SipTrunkDtmfMode = z.infer<typeof SipTrunkDtmfModeSchema>;

export const SipTrunkSrtpPolicySchema = z.enum(['disabled', 'optional', 'required']);
export type SipTrunkSrtpPolicy = z.infer<typeof SipTrunkSrtpPolicySchema>;

const CodecPrefsSchema = z.array(z.string().min(1).max(32)).max(16);

// ── Resource schemas ──────────────────────────────────────────────────────────
export const SipTrunkSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  direction: SipTrunkDirectionSchema,
  status: SipTrunkStatusSchema,
  username: z.string().nullable(),
  realm: z.string(),
  proxy: z.string(),
  port: z.number().int(),
  transport: SipTrunkTransportSchema,
  auth_username: z.string(),
  dtmf_mode: SipTrunkDtmfModeSchema,
  codec_prefs: CodecPrefsSchema.nullable(),
  srtp_policy: SipTrunkSrtpPolicySchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('SipTrunk');
export type SipTrunk = z.infer<typeof SipTrunkSchema>;

// ── Request schemas ───────────────────────────────────────────────────────────
export const CreateSipTrunkBodySchema = z.object({
  name: z.string().min(1),
  direction: SipTrunkDirectionSchema,
  username: z.string().optional(),
  realm: z.string().min(1),
  proxy: z.string().min(1),
  port: z.number().int().optional(),
  transport: SipTrunkTransportSchema.optional(),
  auth_username: z.string().min(1),
  auth_password: z.string().min(1),
  dtmf_mode: SipTrunkDtmfModeSchema.optional(),
  codec_prefs: CodecPrefsSchema.nullable().optional(),
  srtp_policy: SipTrunkSrtpPolicySchema.optional(),
}).openapi('CreateSipTrunkBody');
export type CreateSipTrunkBody = z.infer<typeof CreateSipTrunkBodySchema>;

export const UpdateSipTrunkBodySchema = z.object({
  name: z.string().min(1).optional(),
  direction: SipTrunkDirectionSchema.optional(),
  status: SipTrunkStatusSchema.optional(),
  username: z.string().nullable().optional(),
  realm: z.string().min(1).optional(),
  proxy: z.string().min(1).optional(),
  port: z.number().int().nullable().optional(),
  transport: SipTrunkTransportSchema.optional(),
  auth_username: z.string().min(1).optional(),
  auth_password: z.string().min(1).optional(),
  dtmf_mode: SipTrunkDtmfModeSchema.optional(),
  codec_prefs: CodecPrefsSchema.nullable().optional(),
  srtp_policy: SipTrunkSrtpPolicySchema.optional(),
}).openapi('UpdateSipTrunkBody');
export type UpdateSipTrunkBody = z.infer<typeof UpdateSipTrunkBodySchema>;
