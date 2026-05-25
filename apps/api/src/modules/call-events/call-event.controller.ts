import type { FastifyInstance } from 'fastify';
import { db } from '../../db/client.js';
import { CallEventRepository } from './call-event.repository.js';
import { CallEventService } from './call-event.service.js';
import type { IngestCallEventInput } from './call-event.types.js';

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const service = new CallEventService(new CallEventRepository(db));

export async function callEventController(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { tenant_id?: string } }>(
    '/',
    {
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
    async (req) => {
      const tenantId = req.query.tenant_id ?? DEFAULT_TENANT_ID;
      return { data: await service.listByTenant(tenantId) };
    },
  );

  app.post<{ Body: IngestCallEventInput }>(
    '/internal/ingest',
    {
      schema: {
        body: {
          type: 'object',
          required: ['call_id', 'event_type'],
          additionalProperties: false,
          properties: {
            tenant_id: { type: 'string' },
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
