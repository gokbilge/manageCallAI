import type { FastifyReply, FastifyRequest } from 'fastify';
import { sendUnauthenticated } from '../../errors/index.js';

export async function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await req.jwtVerify();
  } catch {
    return sendUnauthenticated(reply);
  }
}
