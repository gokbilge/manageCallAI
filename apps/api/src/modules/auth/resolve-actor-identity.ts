import type { FastifyRequest } from 'fastify';
import type { ActorType, AuthClaims } from './auth-claims.js';

// Capability name patterns that indicate an MCP/AI agent API key.
const AI_AGENT_CAPABILITY_PATTERNS = ['mcp.', 'ivr.simulate', 'ivr.validate', 'ivr.flows'];
// Capability patterns that indicate an automation (workflow) API key.
const WORKFLOW_CAPABILITY_PATTERNS = ['webhook', 'automation'];

function inferActorType(claims: AuthClaims): ActorType {
  if (!claims.capabilities) {
    // JWT with a role field = human user login.
    return 'user';
  }
  const caps = claims.capabilities;
  if (caps.some((c) => AI_AGENT_CAPABILITY_PATTERNS.some((p) => c.startsWith(p)))) {
    return 'ai_agent';
  }
  if (caps.some((c) => WORKFLOW_CAPABILITY_PATTERNS.some((p) => c.includes(p)))) {
    return 'workflow';
  }
  // Other API key with explicit capability list = automation actor.
  return 'workflow';
}

/**
 * Resolves and stamps AI/MCP actor identity onto auth claims from request headers.
 *
 * MCP server should pass:
 *   X-MCP-Tool-Name   — the tool being invoked (e.g. 'create_ivr_flow')
 *   X-MCP-Session-ID  — stable session/request identifier
 *   X-API-Key-ID      — the API key ID from the auth system
 *
 * actor_type is inferred from the capability set if not passed via header.
 *
 * Call this AFTER jwt/api-key authentication (claims must be present on req.user).
 */
export function resolveActorIdentity(req: FastifyRequest): void {
  const claims = req.user as AuthClaims | undefined;
  if (!claims) return;

  const header = (name: string): string | undefined => {
    const v = req.headers[name];
    return typeof v === 'string' ? v : undefined;
  };

  const toolName = header('x-mcp-tool-name');
  const sessionId = header('x-mcp-session-id');
  const apiKeyId = header('x-api-key-id');

  if (toolName) claims.tool_name = toolName;
  if (sessionId) claims.mcp_session_id = sessionId;
  if (apiKeyId) claims.api_key_id = apiKeyId;

  // Presence of tool_name header is strong evidence of AI/MCP origin.
  if (toolName && !claims.actor_type) {
    claims.actor_type = 'ai_agent';
  } else if (!claims.actor_type) {
    claims.actor_type = inferActorType(claims);
  }
}

/**
 * Returns a structured actor identity record suitable for audit event metadata.
 * Never returns undefined — always produces a valid record.
 */
export function buildActorMetadata(claims: AuthClaims): {
  actor_type: ActorType;
  tool_name: string | undefined;
  mcp_session_id: string | undefined;
  api_key_id: string | undefined;
} {
  return {
    actor_type: claims.actor_type ?? 'user',
    tool_name: claims.tool_name,
    mcp_session_id: claims.mcp_session_id,
    api_key_id: claims.api_key_id,
  };
}
