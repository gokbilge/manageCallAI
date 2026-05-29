import { z } from '../registry.js';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const ChannelProviderTypeSchema = z.enum([
  'whatsapp',
  'telegram',
  'google_meet',
  'custom',
]);
export type ChannelProviderType = z.infer<typeof ChannelProviderTypeSchema>;

export const ChannelAccountStatusSchema = z.enum(['active', 'inactive']);
export type ChannelAccountStatus = z.infer<typeof ChannelAccountStatusSchema>;

// ── Resource schemas ──────────────────────────────────────────────────────────
export const ChannelAccountSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  provider_type: ChannelProviderTypeSchema,
  name: z.string(),
  status: ChannelAccountStatusSchema,
  capabilities: z.array(z.string()),
  provider_config: z.record(z.unknown()),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('ChannelAccount');
export type ChannelAccount = z.infer<typeof ChannelAccountSchema>;

// ── Request schemas ───────────────────────────────────────────────────────────
export const CreateChannelAccountBodySchema = z.object({
  provider_type: ChannelProviderTypeSchema,
  name: z.string().min(1),
  capabilities: z.array(z.string()).optional(),
  provider_config: z.record(z.unknown()).optional(),
}).openapi('CreateChannelAccountBody');
export type CreateChannelAccountBody = z.infer<typeof CreateChannelAccountBodySchema>;

export const UpdateChannelAccountBodySchema = z.object({
  name: z.string().min(1).optional(),
  capabilities: z.array(z.string()).optional(),
  provider_config: z.record(z.unknown()).optional(),
}).openapi('UpdateChannelAccountBody');
export type UpdateChannelAccountBody = z.infer<typeof UpdateChannelAccountBodySchema>;
