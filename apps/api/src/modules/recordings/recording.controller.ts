import type { FastifyInstance, FastifyReply } from 'fastify';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { authenticateRuntime } from '../runtime/runtime-auth.js';
import { RecordingRepository } from './recording.repository.js';
import { RecordingNotFoundError, RecordingService } from './recording.service.js';
import type { IngestRecordingInput } from './recording.types.js';

const service = new RecordingService(new RecordingRepository(db));

export async function recordingController(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { call_id?: string } }>(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_RECORDINGS_VIEW),
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            call_id: { type: 'string', minLength: 1, maxLength: 255 },
          },
        },
      },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listByTenant(user.tenant_id, req.query.call_id) };
    },
  );

  app.get<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_RECORDINGS_VIEW),
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.getById(req.params.id, user.tenant_id) };
      } catch (err) {
        if (err instanceof RecordingNotFoundError) {
          return (reply as FastifyReply).code(404).send({ error: err.message });
        }
        throw err;
      }
    },
  );

  app.post<{ Body: IngestRecordingInput }>(
    '/internal/ingest',
    {
      preHandler: authenticateRuntime,
      schema: {
        body: {
          type: 'object',
          required: ['tenant_id', 'call_id', 'storage_path'],
          additionalProperties: false,
          properties: {
            tenant_id: { type: 'string', minLength: 1 },
            call_id: { type: 'string', minLength: 1 },
            call_event_id: { type: 'string' },
            storage_path: { type: 'string', minLength: 1, maxLength: 2048 },
            duration_secs: { type: 'integer', minimum: 0 },
            size_bytes: { type: 'integer', minimum: 0 },
            recorded_at: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    async (req, reply) => {
      const recording = await service.ingest(req.body);
      return reply.code(201).send({ data: recording });
    },
  );
}
