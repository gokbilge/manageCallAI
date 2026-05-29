import { z } from '../registry.js';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const FlowVersionStateSchema = z.enum([
  'draft',
  'validated',
  'simulated',
  'published',
  'superseded',
  'rolled_back',
]);
export type FlowVersionState = z.infer<typeof FlowVersionStateSchema>;

export const IvrFlowStatusSchema = z.enum(['draft', 'active', 'inactive']);
export type IvrFlowStatus = z.infer<typeof IvrFlowStatusSchema>;

// ── Resource schemas ──────────────────────────────────────────────────────────
export const FlowVersionSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  flow_id: z.string().uuid(),
  version_number: z.number().int(),
  state: FlowVersionStateSchema,
  graph_json: z.record(z.unknown()),
  created_by: z.string().uuid().nullable(),
  created_at: z.string().datetime(),
  validated_at: z.string().datetime().nullable(),
  simulated_at: z.string().datetime().nullable(),
  published_at: z.string().datetime().nullable(),
}).openapi('FlowVersion');
export type FlowVersion = z.infer<typeof FlowVersionSchema>;

export const IvrFlowSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  status: IvrFlowStatusSchema,
  draft_version_id: z.string().uuid().nullable(),
  active_version_id: z.string().uuid().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('IvrFlow');
export type IvrFlow = z.infer<typeof IvrFlowSchema>;

export const IvrFlowWithVersionsSchema = IvrFlowSchema.extend({
  versions: z.array(FlowVersionSchema),
}).openapi('IvrFlowWithVersions');
export type IvrFlowWithVersions = z.infer<typeof IvrFlowWithVersionsSchema>;

export const FlowValidationErrorSchema = z.object({
  field: z.string(),
  message: z.string(),
}).openapi('FlowValidationError');
export type FlowValidationError = z.infer<typeof FlowValidationErrorSchema>;

export const FlowValidationOutcomeSchema = z.object({
  status: z.enum(['passed', 'failed']),
  errors: z.array(FlowValidationErrorSchema),
  warnings: z.array(FlowValidationErrorSchema),
}).openapi('FlowValidationOutcome');
export type FlowValidationOutcome = z.infer<typeof FlowValidationOutcomeSchema>;

export const FlowValidationResultSchema = z.object({
  version: FlowVersionSchema,
  outcome: FlowValidationOutcomeSchema,
}).openapi('FlowValidationResult');
export type FlowValidationResult = z.infer<typeof FlowValidationResultSchema>;

export const SimulationScenarioSchema = z.object({
  digits: z.array(z.string()).optional(),
  collected_digits: z.record(z.string()).optional(),
  caller_number: z.string().optional(),
  now: z.string().optional(),
  force_timeout: z.boolean().optional(),
  force_timeout_nodes: z.array(z.string()).optional(),
  force_invalid: z.boolean().optional(),
  force_invalid_nodes: z.array(z.string()).optional(),
  variables: z.record(z.string()).optional(),
}).openapi('SimulationScenario');
export type SimulationScenario = z.infer<typeof SimulationScenarioSchema>;

export const SimulationFinalActionSchema = z.object({
  type: z.enum(['transfer_extension', 'queue', 'voicemail', 'hangup']),
  extension_id: z.string().uuid().optional(),
  extension_number: z.string().optional(),
  queue_id: z.string().uuid().optional(),
  voicemail_box_id: z.string().uuid().optional(),
}).openapi('SimulationFinalAction');
export type SimulationFinalAction = z.infer<typeof SimulationFinalActionSchema>;

export const SimulationOutcomeSchema = z.object({
  status: z.enum(['passed', 'failed']),
  path: z.array(z.string()),
  final_action: SimulationFinalActionSchema.nullable(),
  errors: z.array(FlowValidationErrorSchema),
}).openapi('SimulationOutcome');
export type SimulationOutcome = z.infer<typeof SimulationOutcomeSchema>;

export const FlowSimulationResultSchema = z.object({
  version: FlowVersionSchema,
  scenario: SimulationScenarioSchema,
  outcome: SimulationOutcomeSchema,
}).openapi('FlowSimulationResult');
export type FlowSimulationResult = z.infer<typeof FlowSimulationResultSchema>;

export const PublishAttemptResultSchema = z.object({
  status: z.enum(['published', 'pending_approval']),
  flow: IvrFlowSchema,
  approval_request_id: z.string().uuid().optional(),
}).openapi('PublishAttemptResult');
export type PublishAttemptResult = z.infer<typeof PublishAttemptResultSchema>;

export const FlowValidationHistoryEntrySchema = z.object({
  id: z.string().uuid(),
  version_id: z.string().uuid().nullable(),
  validator_version: z.string().nullable(),
  status: z.enum(['passed', 'failed', 'warning_only']),
  errors: z.array(FlowValidationErrorSchema),
  warnings: z.array(FlowValidationErrorSchema),
  created_at: z.string().datetime(),
}).openapi('FlowValidationHistoryEntry');
export type FlowValidationHistoryEntry = z.infer<typeof FlowValidationHistoryEntrySchema>;

export const FlowSimulationHistoryEntrySchema = z.object({
  id: z.string().uuid(),
  version_id: z.string().uuid().nullable(),
  scenario: z.record(z.unknown()),
  status: z.enum(['passed', 'failed', 'inconclusive']),
  result_payload: z.record(z.unknown()),
  created_at: z.string().datetime(),
}).openapi('FlowSimulationHistoryEntry');
export type FlowSimulationHistoryEntry = z.infer<typeof FlowSimulationHistoryEntrySchema>;

export const FlowPublishHistoryEntrySchema = z.object({
  id: z.string().uuid(),
  version_id: z.string().uuid().nullable(),
  action_type: z.enum(['publish', 'rollback']),
  triggered_by_type: z.enum(['user', 'workflow', 'ai_agent', 'system']),
  triggered_by_id: z.string().uuid().nullable(),
  approval_request_id: z.string().uuid().nullable(),
  approval_status: z.enum(['pending', 'approved', 'rejected', 'expired']).nullable(),
  decision_at: z.string().datetime().nullable(),
  result: z.enum(['success', 'failed', 'pending_approval']),
  created_at: z.string().datetime(),
}).openapi('FlowPublishHistoryEntry');
export type FlowPublishHistoryEntry = z.infer<typeof FlowPublishHistoryEntrySchema>;

export const FlowAuditHistoryEntrySchema = z.object({
  id: z.string().uuid(),
  actor_type: z.enum(['user', 'workflow', 'ai_agent', 'system']),
  actor_id: z.string().uuid().nullable(),
  action: z.string(),
  metadata: z.record(z.unknown()),
  created_at: z.string().datetime(),
}).openapi('FlowAuditHistoryEntry');
export type FlowAuditHistoryEntry = z.infer<typeof FlowAuditHistoryEntrySchema>;

export const FlowHistorySchema = z.object({
  validations: z.array(FlowValidationHistoryEntrySchema),
  simulations: z.array(FlowSimulationHistoryEntrySchema),
  publishes: z.array(FlowPublishHistoryEntrySchema),
  audits: z.array(FlowAuditHistoryEntrySchema),
}).openapi('FlowHistory');
export type FlowHistory = z.infer<typeof FlowHistorySchema>;

// ── Request schemas ───────────────────────────────────────────────────────────
export const CreateIvrFlowBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  graph_json: z.record(z.unknown()),
}).openapi('CreateIvrFlowBody');
export type CreateIvrFlowBody = z.infer<typeof CreateIvrFlowBodySchema>;

export const UpdateIvrFlowBodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: IvrFlowStatusSchema.optional(),
}).openapi('UpdateIvrFlowBody');
export type UpdateIvrFlowBody = z.infer<typeof UpdateIvrFlowBodySchema>;
