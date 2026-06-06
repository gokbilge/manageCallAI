import { z } from '../registry.js';
import {
  SipTrunkDirectionSchema,
  SipTrunkDtmfModeSchema,
  SipTrunkSrtpPolicySchema,
  SipTrunkTransportSchema,
} from './sip-trunks.js';

const CarrierAssistantCodecPrefsSchema = z.array(z.string().min(1).max(32)).max(16);

export const CarrierAssistantDraftSchema = z.object({
  name: z.string().min(1).max(255).nullable(),
  direction: SipTrunkDirectionSchema.nullable(),
  username: z.string().min(1).max(255).nullable(),
  realm: z.string().min(1).max(255).nullable(),
  proxy: z.string().min(1).max(255).nullable(),
  port: z.number().int().min(1).max(65535).nullable(),
  transport: SipTrunkTransportSchema.nullable(),
  auth_username: z.string().min(1).max(255).nullable(),
  dtmf_mode: SipTrunkDtmfModeSchema.nullable(),
  codec_prefs: CarrierAssistantCodecPrefsSchema.nullable(),
  srtp_policy: SipTrunkSrtpPolicySchema.nullable(),
}).openapi('CarrierAssistantDraft');
export type CarrierAssistantDraft = z.infer<typeof CarrierAssistantDraftSchema>;

export const CarrierAssistantMissingFieldSchema = z.object({
  field: z.string().min(1).max(64),
  reason: z.string().min(1).max(500),
}).openapi('CarrierAssistantMissingField');
export type CarrierAssistantMissingField = z.infer<typeof CarrierAssistantMissingFieldSchema>;

export const CarrierAssistantValidationCheckStatusSchema = z.enum(['ready', 'needs_input', 'recommended']);
export type CarrierAssistantValidationCheckStatus = z.infer<typeof CarrierAssistantValidationCheckStatusSchema>;

export const CarrierAssistantValidationCheckSchema = z.object({
  code: z.string().min(1).max(64),
  description: z.string().min(1).max(500),
  status: CarrierAssistantValidationCheckStatusSchema,
}).openapi('CarrierAssistantValidationCheck');
export type CarrierAssistantValidationCheck = z.infer<typeof CarrierAssistantValidationCheckSchema>;

export const CarrierAssistantRuntimeHintSchema = z.object({
  gateway_state: z.string().min(1).max(64).nullable(),
  gateway_observed_at: z.string().datetime().nullable(),
  latest_apply_status: z.enum(['pending', 'applying', 'applied', 'failed', 'cancelled']).nullable(),
  latest_apply_error: z.string().nullable(),
}).openapi('CarrierAssistantRuntimeHint');
export type CarrierAssistantRuntimeHint = z.infer<typeof CarrierAssistantRuntimeHintSchema>;

export const CarrierAssistantSuggestionSchema = z.object({
  assistant_mode: z.enum(['create', 'update']),
  target_trunk_id: z.string().uuid().nullable(),
  target_trunk_name: z.string().nullable(),
  matched_template: z.string().nullable(),
  suggested_config: CarrierAssistantDraftSchema,
  missing_fields: z.array(CarrierAssistantMissingFieldSchema),
  assumptions: z.array(z.string().min(1).max(500)),
  warnings: z.array(z.string().min(1).max(500)),
  validation_errors: z.array(z.string().min(1).max(500)),
  validation_checks: z.array(CarrierAssistantValidationCheckSchema),
  next_steps: z.array(z.string().min(1).max(500)),
  runtime_hint: CarrierAssistantRuntimeHintSchema.nullable(),
}).openapi('CarrierAssistantSuggestion');
export type CarrierAssistantSuggestion = z.infer<typeof CarrierAssistantSuggestionSchema>;

export const CreateCarrierAssistantSuggestionBodySchema = z.object({
  intent: z.string().min(1).max(4000),
  trunk_id: z.string().uuid().optional(),
}).openapi('CreateCarrierAssistantSuggestionBody');
export type CreateCarrierAssistantSuggestionBody = z.infer<typeof CreateCarrierAssistantSuggestionBodySchema>;
