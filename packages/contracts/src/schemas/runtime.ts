import { z } from '../registry.js';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const RuntimeSessionStatusSchema = z.enum(['running', 'completed', 'failed']);
export type RuntimeSessionStatus = z.infer<typeof RuntimeSessionStatusSchema>;

export const OutboundCallStatusSchema = z.enum([
  'pending',
  'dispatched',
  'answered',
  'completed',
  'failed',
  'expired',
]);
export type OutboundCallStatus = z.infer<typeof OutboundCallStatusSchema>;

// ── Resource schemas ──────────────────────────────────────────────────────────
export const IvrRuntimeSessionSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  flow_id: z.string().uuid(),
  flow_version_id: z.string().uuid(),
  call_id: z.string(),
  status: RuntimeSessionStatusSchema,
  current_node_id: z.string().nullable(),
  caller_number: z.string().nullable(),
  destination_number: z.string().nullable(),
  last_digits: z.string().nullable(),
  variables_json: z.record(z.string()),
  last_action_json: z.record(z.unknown()).nullable(),
  completed_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('IvrRuntimeSession');
export type IvrRuntimeSession = z.infer<typeof IvrRuntimeSessionSchema>;

export const IvrRuntimeSessionStepSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  session_id: z.string().uuid(),
  step_index: z.number().int(),
  phase: z.enum(['start', 'advance']),
  node_id: z.string().nullable(),
  outcome: z.enum(['start', 'completed', 'digits', 'timeout', 'invalid']),
  digits: z.string().nullable(),
  action_json: z.record(z.unknown()).nullable(),
  resulting_node_id: z.string().nullable(),
  resulting_status: RuntimeSessionStatusSchema,
  variables_json: z.record(z.string()),
  created_at: z.string().datetime(),
}).openapi('IvrRuntimeSessionStep');
export type IvrRuntimeSessionStep = z.infer<typeof IvrRuntimeSessionStepSchema>;

export const IvrRuntimeActionSchema = z.union([
  z.object({
    action: z.literal('play_prompt'),
    node_id: z.string(),
    prompt_id: z.string(),
    prompt_uri: z.string(),
  }),
  z.object({
    action: z.literal('play_collect'),
    node_id: z.string(),
    prompt_id: z.string(),
    prompt_uri: z.string(),
    max_digits: z.number().int(),
    timeout_ms: z.number().int(),
    retries: z.number().int(),
  }),
  z.object({
    action: z.literal('transfer'),
    node_id: z.string(),
    target_type: z.literal('extension'),
    target: z.string(),
    domain: z.string().nullable(),
  }),
  z.object({
    action: z.literal('transfer'),
    node_id: z.string(),
    target_type: z.literal('queue'),
    strategy: z.enum(['simultaneous', 'sequential']),
    ring_timeout_seconds: z.number().int(),
    members: z.array(z.object({
      extension_number: z.string(),
      domain: z.string().nullable(),
    })),
  }),
  z.object({
    action: z.literal('voicemail'),
    node_id: z.string(),
    mailbox_number: z.string(),
    domain: z.string().nullable(),
    greeting_prompt_uri: z.string().nullable(),
  }),
  z.object({
    action: z.literal('hangup'),
    node_id: z.string(),
  }),
]).openapi('IvrRuntimeAction');
export type IvrRuntimeAction = z.infer<typeof IvrRuntimeActionSchema>;

export const IvrRuntimeSessionResultSchema = z.object({
  session: IvrRuntimeSessionSchema,
  action: IvrRuntimeActionSchema.nullable(),
}).openapi('IvrRuntimeSessionResult');
export type IvrRuntimeSessionResult = z.infer<typeof IvrRuntimeSessionResultSchema>;

export const OutboundCallRequestSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  extension_id: z.string().uuid(),
  dial_number: z.string(),
  route_id: z.string().uuid().nullable(),
  sip_trunk_id: z.string().uuid().nullable(),
  status: OutboundCallStatusSchema,
  failure_reason: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('OutboundCallRequest');
export type OutboundCallRequest = z.infer<typeof OutboundCallRequestSchema>;

// ── Request schemas ───────────────────────────────────────────────────────────
export const StartIvrRuntimeSessionBodySchema = z.object({
  call_id: z.string().min(1),
  flow_id: z.string().uuid(),
  caller_number: z.string().optional(),
  destination_number: z.string().optional(),
  variables: z.record(z.string()).optional(),
}).openapi('StartIvrRuntimeSessionBody');
export type StartIvrRuntimeSessionBody = z.infer<typeof StartIvrRuntimeSessionBodySchema>;

export const AdvanceIvrRuntimeSessionBodySchema = z.object({
  node_id: z.string().min(1),
  outcome: z.enum(['completed', 'digits', 'timeout', 'invalid']),
  digits: z.string().optional(),
  variables: z.record(z.string()).optional(),
}).openapi('AdvanceIvrRuntimeSessionBody');
export type AdvanceIvrRuntimeSessionBody = z.infer<typeof AdvanceIvrRuntimeSessionBodySchema>;

export const CreateOutboundCallBodySchema = z.object({
  extension_id: z.string().uuid(),
  dial_number: z.string().min(1),
  route_id: z.string().uuid().optional(),
}).openapi('CreateOutboundCallBody');
export type CreateOutboundCallBody = z.infer<typeof CreateOutboundCallBodySchema>;
