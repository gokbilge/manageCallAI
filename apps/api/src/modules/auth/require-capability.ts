import type { FastifyReply, FastifyRequest } from 'fastify';
import { resolveApiKey } from '../automation/api-key-auth.js';
import type { AuthClaims } from './auth-claims.js';
import { type Capability, hasCapability } from './capabilities.js';
import { sendPermissionDenied, sendUnauthenticated } from '../../errors/index.js';

function apiKeyHasCapability(
  capabilities: readonly string[],
  capability: Capability,
): boolean {
  return capabilities.includes(capability);
}

export function requireCapability(capability: Capability) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    if (token?.startsWith('mcak_')) {
      const claims = await resolveApiKey(token);
      if (!claims) return sendUnauthenticated(reply);
      req.user = claims;
    } else {
      try {
        await req.jwtVerify();
      } catch {
        return sendUnauthenticated(reply);
      }
    }

    const user = req.user as AuthClaims;

    // API key path: check explicit capabilities list.
    if (user.capabilities !== undefined) {
      if (!apiKeyHasCapability(user.capabilities, capability)) {
        return sendPermissionDenied(reply);
      }
      return;
    }

    // JWT path: check role-based capability mapping.
    if (!hasCapability(user.role, capability)) {
      return sendPermissionDenied(reply);
    }
  };
}
