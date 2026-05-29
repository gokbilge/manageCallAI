import type { FastifyReply, FastifyRequest } from 'fastify';
import { resolveApiKey } from '../automation/api-key-auth.js';
import type { AuthClaims } from './auth-claims.js';
import { type Capability, hasCapability } from './capabilities.js';
import { sendPermissionDenied, sendUnauthenticated } from '../../errors/index.js';

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
    if (!hasCapability(user.role, capability)) {
      return sendPermissionDenied(reply);
    }
  };
}
