import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../../config/env.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { sendPermissionDenied, sendUnauthenticated } from '../../errors/index.js';

export async function authenticatePlatform(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await req.jwtVerify();
  } catch {
    return sendUnauthenticated(reply);
  }
  const user = req.user as AuthClaims;
  if (!config.platformOperatorEmails.includes(user.email)) {
    return sendPermissionDenied(reply);
  }
}
