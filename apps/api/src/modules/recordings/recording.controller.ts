import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { db } from '../../db/client.js';
import { config } from '../../config/env.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { fireWebhooks } from '../automation/webhook-delivery.js';
import { authenticateRuntime } from '../runtime/runtime-auth.js';
import { RecordingRepository } from './recording.repository.js';
import { RecordingNotFoundError, RecordingPlaybackPathError, RecordingService } from './recording.service.js';
import type {
  ClaimRecordingAnalysisInput,
  CompleteRecordingAnalysisInput,
  CreateRecordingAnalysisInput,
  IngestRecordingInput,
} from './recording.types.js';

const service = new RecordingService(new RecordingRepository(db), config.recordingStorageRoot);

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

  app.get<{ Params: { id: string } }>(
    '/:id/playback',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_RECORDINGS_VIEW),
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const playback = await service.getPlaybackPath(req.params.id, user.tenant_id);
        const fileStat = await stat(playback.file_path);
        return (reply as FastifyReply)
          .header('Content-Type', 'audio/wav')
          .header('Content-Length', fileStat.size.toString())
          .send(createReadStream(playback.file_path));
      } catch (err) {
        if (err instanceof RecordingNotFoundError) {
          return (reply as FastifyReply).code(404).send({ error: err.message });
        }
        if (err instanceof RecordingPlaybackPathError) {
          return (reply as FastifyReply).code(409).send({ error: err.message });
        }
        if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
          return (reply as FastifyReply).code(404).send({ error: 'Recording media file not found' });
        }
        throw err;
      }
    },
  );

  app.post<{ Params: { id: string }; Body: CreateRecordingAnalysisInput }>(
    '/:id/analysis-requests',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_RECORDINGS_VIEW),
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          required: ['requested_outputs'],
          additionalProperties: false,
          properties: {
            requested_outputs: {
              type: 'array',
              minItems: 1,
              uniqueItems: true,
              items: { type: 'string', enum: ['transcript', 'summary'] },
            },
            language_hint: { type: 'string', minLength: 2, maxLength: 32 },
            metadata: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const request = await service.createAnalysisRequest(req.params.id, user.tenant_id, req.body);
        return reply.code(201).send({ data: request });
      } catch (err) {
        if (err instanceof RecordingNotFoundError) return (reply as FastifyReply).code(404).send({ error: err.message });
        throw err;
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    '/:id/analysis-requests',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_RECORDINGS_VIEW),
      schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.listAnalysisRequests(req.params.id, user.tenant_id) };
      } catch (err) {
        if (err instanceof RecordingNotFoundError) return (reply as FastifyReply).code(404).send({ error: err.message });
        throw err;
      }
    },
  );

  app.get<{ Params: { id: string; requestId: string } }>(
    '/:id/analysis-requests/:requestId',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_RECORDINGS_VIEW),
      schema: {
        params: {
          type: 'object',
          required: ['id', 'requestId'],
          properties: { id: { type: 'string' }, requestId: { type: 'string' } },
        },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const request = await service.getAnalysisRequest(req.params.requestId, user.tenant_id);
        if (request.recording_id !== req.params.id) {
          return (reply as FastifyReply).code(404).send({ error: 'Recording analysis request not found' });
        }
        return { data: request };
      } catch (err) {
        if (err instanceof RecordingNotFoundError) return (reply as FastifyReply).code(404).send({ error: err.message });
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
      fireWebhooks(recording.tenant_id, 'voicemail.recording_available', {
        recording_id: recording.id,
        call_id: recording.call_id,
        status: recording.status,
        recorded_at: recording.recorded_at,
      });
      return reply.code(201).send({ data: recording });
    },
  );
}

export async function recordingAnalysisController(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { requestId: string }; Body: ClaimRecordingAnalysisInput }>(
    '/internal/:requestId/claim',
    {
      preHandler: authenticateRuntime,
      schema: {
        params: { type: 'object', required: ['requestId'], properties: { requestId: { type: 'string' } } },
        body: {
          type: 'object',
          additionalProperties: false,
          properties: { processor_id: { type: 'string', maxLength: 255 } },
        },
      },
    },
    async (req, reply) => {
      try {
        return { data: await service.claimAnalysisRequest(req.params.requestId, req.body) };
      } catch (err) {
        if (err instanceof RecordingNotFoundError) return reply.code(404).send({ error: err.message });
        throw err;
      }
    },
  );

  app.post<{ Params: { requestId: string }; Body: CompleteRecordingAnalysisInput }>(
    '/internal/:requestId/result',
    {
      preHandler: authenticateRuntime,
      schema: {
        params: { type: 'object', required: ['requestId'], properties: { requestId: { type: 'string' } } },
        body: {
          type: 'object',
          required: ['status'],
          additionalProperties: false,
          properties: {
            status: { type: 'string', enum: ['completed', 'failed'] },
            language: { type: 'string', maxLength: 32 },
            transcript_text: { type: 'string', maxLength: 100000 },
            summary_text: { type: 'string', maxLength: 10000 },
            error_message: { type: 'string', maxLength: 500 },
            provider_metadata: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        return { data: await service.completeAnalysisRequest(req.params.requestId, req.body) };
      } catch (err) {
        if (err instanceof RecordingNotFoundError) return reply.code(404).send({ error: err.message });
        throw err;
      }
    },
  );
}
