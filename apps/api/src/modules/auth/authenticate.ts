import type { FastifyReply, FastifyRequest } from 'fastify';

export async function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await req.jwtVerify();
  } catch {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}
