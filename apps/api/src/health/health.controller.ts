import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { db } from '../db/client.js';

export const healthController: FastifyPluginAsyncZod = async (app) => {
  app.get('/', async (_req, reply) => {
    try {
      await db.query('SELECT 1');
      return { status: 'ok', db: 'ok' };
    } catch {
      return reply.code(503).send({ status: 'error', db: 'unreachable' });
    }
  });
};
