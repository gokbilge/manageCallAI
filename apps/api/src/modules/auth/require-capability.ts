import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthClaims } from './auth-claims.js';
import { type Capability, hasCapability } from './capabilities.js';

export function requireCapability(capability: Capability) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    const user = req.user as AuthClaims;
    if (!hasCapability(user.role, capability)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
  };
}
