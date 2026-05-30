import { describe, expect, it } from 'vitest';
import { buildActorMetadata, resolveActorIdentity } from './resolve-actor-identity.js';
import type { AuthClaims } from './auth-claims.js';

function makeReq(headers: Record<string, string>, claims: AuthClaims) {
  return {
    headers,
    user: claims,
  } as unknown as import('fastify').FastifyRequest;
}

function makeClaims(partial: Partial<AuthClaims> = {}): AuthClaims {
  return { sub: 'u1', tenant_id: 't1', email: 'a@b.com', ...partial };
}

describe('resolveActorIdentity', () => {
  it('sets actor_type to user for JWT claims without capabilities', () => {
    const claims = makeClaims({ role: 'tenant_admin' });
    resolveActorIdentity(makeReq({}, claims));
    expect(claims.actor_type).toBe('user');
  });

  it('infers ai_agent when x-mcp-tool-name header is present', () => {
    const claims = makeClaims({ capabilities: ['tenant.ivr.flows.view'] });
    resolveActorIdentity(makeReq({ 'x-mcp-tool-name': 'validate_flow' }, claims));
    expect(claims.actor_type).toBe('ai_agent');
    expect(claims.tool_name).toBe('validate_flow');
  });

  it('stamps mcp_session_id from x-mcp-session-id header', () => {
    const claims = makeClaims({ capabilities: ['*'] });
    resolveActorIdentity(makeReq({ 'x-mcp-session-id': 'sess-abc-123' }, claims));
    expect(claims.mcp_session_id).toBe('sess-abc-123');
  });

  it('stamps api_key_id from x-api-key-id header', () => {
    const claims = makeClaims({ capabilities: ['tenant.ivr.flows.create'] });
    resolveActorIdentity(makeReq({ 'x-api-key-id': 'key-xyz-789' }, claims));
    expect(claims.api_key_id).toBe('key-xyz-789');
  });

  it('infers ai_agent for API key with mcp. capability prefix', () => {
    const claims = makeClaims({ capabilities: ['mcp.ivr.flows'] });
    resolveActorIdentity(makeReq({}, claims));
    expect(claims.actor_type).toBe('ai_agent');
  });

  it('infers workflow for API key with webhook capability', () => {
    const claims = makeClaims({ capabilities: ['tenant.webhooks.view'] });
    resolveActorIdentity(makeReq({}, claims));
    expect(claims.actor_type).toBe('workflow');
  });

  it('infers workflow for API key with automation capability', () => {
    const claims = makeClaims({ capabilities: ['automation.events.create'] });
    resolveActorIdentity(makeReq({}, claims));
    expect(claims.actor_type).toBe('workflow');
  });

  it('does not overwrite an existing actor_type that was already set', () => {
    const claims = makeClaims({ actor_type: 'system' });
    resolveActorIdentity(makeReq({ 'x-mcp-tool-name': 'list_ivr_flows' }, claims));
    // actor_type stays 'system' — not overwritten because it was pre-set
    // BUT tool_name should still be set
    expect(claims.actor_type).toBe('system');
    expect(claims.tool_name).toBe('list_ivr_flows');
  });

  it('is a no-op when req.user is undefined', () => {
    const req = { headers: {}, user: undefined } as unknown as import('fastify').FastifyRequest;
    expect(() => resolveActorIdentity(req)).not.toThrow();
  });
});

describe('buildActorMetadata', () => {
  it('returns default user actor_type when no actor fields are set', () => {
    const claims = makeClaims({ role: 'tenant_admin' });
    const meta = buildActorMetadata(claims);
    expect(meta.actor_type).toBe('user');
    expect(meta.tool_name).toBeUndefined();
    expect(meta.mcp_session_id).toBeUndefined();
    expect(meta.api_key_id).toBeUndefined();
  });

  it('includes all AI actor fields when set', () => {
    const claims = makeClaims({
      actor_type: 'ai_agent',
      tool_name: 'request_publish',
      mcp_session_id: 'sess-1',
      api_key_id: 'key-1',
    });
    const meta = buildActorMetadata(claims);
    expect(meta.actor_type).toBe('ai_agent');
    expect(meta.tool_name).toBe('request_publish');
    expect(meta.mcp_session_id).toBe('sess-1');
    expect(meta.api_key_id).toBe('key-1');
  });

  it('AI actor identity cannot be downgraded to user by omitting actor_type', () => {
    const claims = makeClaims({ capabilities: ['mcp.ivr.flows'] });
    resolveActorIdentity(makeReq({}, claims));
    const meta = buildActorMetadata(claims);
    // inferred as ai_agent — cannot be silently downgraded to user
    expect(meta.actor_type).toBe('ai_agent');
    expect(meta.actor_type).not.toBe('user');
  });
});
