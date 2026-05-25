import type { FastifyInstance } from 'fastify';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { authenticate } from '../auth/authenticate.js';
import { CallEventRepository } from './call-event.repository.js';
import { CallEventService } from './call-event.service.js';
import type { IngestCallEventInput } from './call-event.types.js';
import { authenticateRuntime } from '../runtime/runtime-auth.js';
const service = new CallEventService(new CallEventRepository(db));

export async function callEventController(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { tenant_id?: string } }>(
    '/',
    {
      preHandler: authenticate,
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            tenant_id: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      const tenantId = req.query.tenant_id ?? user.tenant_id;
      if (tenantId !== user.tenant_id) {
        return reply.code(403).send({ error: 'Forbidden' });
      }
      return { data: await service.listByTenant(tenantId) };
    },
  );

  app.post<{ Body: IngestCallEventInput }>(
    '/internal/ingest',
    {
      preHandler: authenticateRuntime,
      schema: {
        body: {
          type: 'object',
          required: ['tenant_id', 'call_id', 'event_type'],
          additionalProperties: false,
          properties: {
            tenant_id: { type: 'string', minLength: 1 },
            call_id: { type: 'string', minLength: 1 },
            event_type: { type: 'string', minLength: 1 },
            event_time: { type: 'string' },
            source: { type: 'string' },
            payload: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
    async (req, reply) => {
      const event = await service.ingest(req.body);
      return reply.code(201).send({ data: event });
    },
  );
}
