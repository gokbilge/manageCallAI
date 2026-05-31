import type { Role } from './capabilities.js';

// Actor types aligned with the audit_events schema.
export type ActorType = 'user' | 'workflow' | 'ai_agent' | 'system';

export interface AuthClaims {
  sub: string;
  tenant_id: string;
  email: string;
  role?: Role;
  /**
   * Explicit capability list for API key authentication.
   * When present, `requireCapability` checks this list instead of deriving
   * capabilities from `role`. The special value ['*'] grants the full
   * tenant_admin capability set (legacy behaviour for existing API keys).
   */
  capabilities?: readonly string[];
  // AI/MCP actor identity fields — populated when the request originates from
  // an MCP session or an automation API key, not a human user JWT.
  actor_type?: ActorType;
  // MCP tool name that initiated this request (e.g. 'create_ivr_flow').
  tool_name?: string;
  // Stable identifier for the MCP session or n8n workflow execution.
  mcp_session_id?: string;
  // ID of the API key used to authenticate this request.
  api_key_id?: string;
}
