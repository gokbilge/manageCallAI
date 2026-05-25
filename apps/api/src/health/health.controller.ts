import type { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';

export async function healthController(app: FastifyInstance): Promise<void> {
  app.get('/', async (_req, reply) => {
    try {
      await db.query('SELECT 1');
      return { status: 'ok', db: 'ok' };
    } catch {
      return reply.code(503).send({ status: 'error', db: 'unreachable' });
    }
  });
}
