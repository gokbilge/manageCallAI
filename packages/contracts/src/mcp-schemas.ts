/**
 * MCP tool input schemas.
 *
 * Each schema covers the complete input for one MCP tool — path parameters and
 * body fields merged into a single flat object. Tool handlers are responsible
 * for separating path params from body params before forwarding to the API.
 *
 * Schemas are derived from the same Zod definitions used for the REST API so
 * that inputSchema drift between MCP tools and REST contracts is structurally
 * impossible. scripts/check-mcp-schemas.mjs enforces this in CI.
 */

import { zodToJsonSchema } from 'zod-to-json-schema';
import { z } from './registry.js';
import { ApprovalDecisionBodySchema, ApprovalStatusSchema } from './schemas/approvals.js';
import {
  SimulationScenarioSchema,
  CreateIvrFlowBodySchema,
  FlowVersionStateSchema,
} from './schemas/ivr-flows.js';
import { RuntimeSessionStatusSchema } from './schemas/runtime.js';

// ── Reusable param fragments ──────────────────────────────────────────────────
const FlowId = z.object({ flow_id: z.string().uuid().describe('UUID of the IVR flow') });
const VersionId = z.object({ version_id: z.string().uuid().describe('UUID of the flow version') });
const ApprovalId = z.object({ approval_id: z.string().uuid().describe('UUID of the approval request') });
const SessionId = z.object({ session_id: z.string().uuid().describe('UUID of the runtime session') });
const PromptId = z.object({ prompt_id: z.string().uuid().describe('UUID of the prompt asset') });

// ── Approval tool input schemas ───────────────────────────────────────────────
const listApprovalsInput = z.object({
  status: ApprovalStatusSchema.optional().describe('Filter by approval status'),
});

const getApprovalInput = ApprovalId;

// Extends the REST body schema with the path param. Note: decision uses the
// contract enum values ('approved'/'rejected'), NOT 'approve'/'reject'.
const decideApprovalInput = ApprovalId.merge(ApprovalDecisionBodySchema).extend({
  note: z.string().optional().describe('Optional note to attach to the decision'),
});

// ── IVR flow tool input schemas ───────────────────────────────────────────────
const listIvrFlowsInput = z.object({});

const getIvrFlowInput = FlowId;

const createIvrFlowInput = CreateIvrFlowBodySchema.omit({ graph_json: true }).extend({
  name: z.string().min(1).describe('Display name for the flow'),
  description: z.string().optional().describe('Optional description'),
  definition: z.record(z.unknown()).optional().describe('Optional initial graph definition (nodes/edges)'),
});

const updateFlowDefinitionInput = FlowId.merge(VersionId).extend({
  definition: z.record(z.unknown()).describe('New graph definition object (nodes/edges/entry_node_id)'),
});

const validateFlowInput = FlowId;

// Merges the simulation scenario fields with the required flow_id param.
const simulateFlowInput = FlowId.merge(SimulationScenarioSchema);

const requestPublishInput = FlowId.merge(VersionId);

const runSimulationSuiteInput = FlowId.extend({
  scenarios: z.array(
    z.object({
      label: z.string().optional().describe('Human-readable name for this scenario'),
      caller_number: z.string().optional().describe('Simulated caller E.164 number'),
      digits: z.array(z.string()).optional().describe('DTMF digit sequences to inject'),
      now: z.string().optional().describe('ISO 8601 datetime override for time-of-day branches'),
      force_timeout: z.boolean().optional(),
      force_timeout_nodes: z.array(z.string()).optional(),
      force_invalid: z.boolean().optional(),
      force_invalid_nodes: z.array(z.string()).optional(),
    }),
  ).describe('Array of simulation scenarios to run'),
});

// ── Runtime tool input schemas ────────────────────────────────────────────────
const listSessionsInput = z.object({
  status: RuntimeSessionStatusSchema.optional().describe('Optional status filter'),
});

const getSessionInput = SessionId;

// ── Prompt tool input schemas ─────────────────────────────────────────────────
const listPromptsInput = z.object({});

const getPromptInput = PromptId;

// ── Schedule tool input schemas ───────────────────────────────────────────────
const listSchedulesInput = z.object({});

// ── Flow version filtering (supplementary) ────────────────────────────────────
const listFlowVersionsInput = FlowId.extend({
  state: FlowVersionStateSchema.optional().describe('Filter by version state'),
});

// ── Exported map — Zod schemas ────────────────────────────────────────────────
// Used for TypeScript type inference and for generating the JSON Schema below.
export const mcpToolZodSchemas = {
  // approvals
  list_approvals: listApprovalsInput,
  get_approval: getApprovalInput,
  decide_approval: decideApprovalInput,
  // ivr flows
  list_ivr_flows: listIvrFlowsInput,
  get_ivr_flow: getIvrFlowInput,
  create_ivr_flow: createIvrFlowInput,
  update_flow_definition: updateFlowDefinitionInput,
  validate_flow: validateFlowInput,
  simulate_flow: simulateFlowInput,
  request_publish: requestPublishInput,
  run_simulation_suite: runSimulationSuiteInput,
  // runtime
  list_sessions: listSessionsInput,
  get_session: getSessionInput,
  // prompts
  list_prompts: listPromptsInput,
  get_prompt: getPromptInput,
  // schedules
  list_schedules: listSchedulesInput,
  // supplementary
  list_flow_versions: listFlowVersionsInput,
} as const;

export type McpToolName = keyof typeof mcpToolZodSchemas;

// ── Exported map — JSON Schema ─────────────────────────────────────────────────
// These are the values that MCP tool inputSchema fields should be set to.
// The check-mcp-schemas.mjs script validates that every tool in apps/mcp
// uses these exact schemas (structurally equal properties + required arrays).
export const mcpToolInputSchemas: Record<McpToolName, Record<string, unknown>> = Object.fromEntries(
  Object.entries(mcpToolZodSchemas).map(([name, schema]) => [
    name,
    zodToJsonSchema(schema, { target: 'jsonSchema7', $refStrategy: 'none' }),
  ]),
) as Record<McpToolName, Record<string, unknown>>;
