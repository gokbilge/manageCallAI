/**
 * Tool-level risk classification for AI agent operations.
 *
 * Risk levels:
 *   read     — Read-only. No state is mutated. Safe to call without review.
 *   low      — Writes to draft state only. Reversible. Does not affect live calls.
 *   medium   — Submits for approval or validation. Not yet live. Requires human review
 *              before production effect.
 *   high     — Publishes, rollbacks, or approves. Directly affects live call routing.
 *              Should require human confirmation or policy-based approval.
 *   critical — Not currently exposed via MCP. Reserved for future emergency ops.
 *
 * Usage: Include `risk` in tool descriptions so AI agents and orchestrators can
 * gate on risk level before executing. The canary pattern:
 *   1. AI agent proposes change (risk=low/medium).
 *   2. Human reviews diff via GET /api/v1/ivr-flows/:id/diff.
 *   3. Human approves publish (risk=high) in the UI or via the approval API.
 */

export type ToolRisk = 'read' | 'low' | 'medium' | 'high';

export const TOOL_RISK_MAP: Record<string, ToolRisk> = {
  // IVR flow tools
  list_ivr_flows: 'read',
  get_ivr_flow: 'read',
  create_ivr_flow: 'low',
  update_flow_definition: 'low',
  validate_flow: 'medium',
  simulate_flow: 'read',
  run_simulation_suite: 'read',
  request_publish: 'high',

  // Approval tools
  list_approvals: 'read',
  get_approval: 'read',
  decide_approval: 'high',

  // Prompt tools
  list_prompts: 'read',
  get_prompt: 'read',
  create_prompt: 'low',
  update_prompt: 'low',

  // Runtime tools
  list_outbound_calls: 'read',
  create_outbound_call: 'high',
  get_outbound_call: 'read',

  // Schedule tools
  list_schedules: 'read',
  get_schedule: 'read',
  create_schedule: 'low',
  update_schedule: 'low',

  // Recording tools
  list_recordings: 'read',
  get_recording: 'read',
  request_recording_analysis: 'low',

  // Export tools
  export_call_events: 'read',
  export_ivr_sessions: 'read',
};

/** Returns the risk level for a tool, defaulting to 'medium' if unclassified. */
export function getToolRisk(toolName: string): ToolRisk {
  return TOOL_RISK_MAP[toolName] ?? 'medium';
}
