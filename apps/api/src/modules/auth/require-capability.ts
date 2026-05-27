import type { FastifyReply, FastifyRequest } from 'fastify';
import { resolveApiKey } from '../automation/api-key-auth.js';
import type { AuthClaims } from './auth-claims.js';
import { type Capability, hasCapability } from './capabilities.js';

export function requireCapability(capability: Capability) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    if (token?.startsWith('mcak_')) {
      const claims = await resolveApiKey(token);
      if (!claims) return reply.code(401).send({ error: 'Unauthorized' });
      req.user = claims;
    } else {
      try {
        await req.jwtVerify();
      } catch {
        return reply.code(401).send({ error: 'Unauthorized' });
      }
    }

    const user = req.user as AuthClaims;
    if (!hasCapability(user.role, capability)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
  };
}
