import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../../config/env.js';
import type { AuthClaims } from '../auth/auth-claims.js';

export async function authenticatePlatform(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await req.jwtVerify();
  } catch {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
  const user = req.user as AuthClaims;
  if (!config.platformOperatorEmails.includes(user.email)) {
    return reply.code(403).send({ error: 'Forbidden' });
  }
}
