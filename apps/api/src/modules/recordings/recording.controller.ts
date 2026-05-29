import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { UuidParamsSchema, CreateRecordingAnalysisBodySchema } from '@managecallai/contracts';
import { db } from '../../db/client.js';
import { config } from '../../config/env.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { fireWebhooks } from '../automation/webhook-delivery.js';
import { authenticateRuntime } from '../runtime/runtime-auth.js';
import { RecordingRepository } from './recording.repository.js';
import { RecordingNotFoundError, RecordingPlaybackPathError, RecordingService } from './recording.service.js';
import { sendNotFound, sendConflict } from '../../errors/index.js';

const service = new RecordingService(new RecordingRepository(db), config.recordingStorageRoot);

export const recordingController: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_RECORDINGS_VIEW),
      schema: {
        querystring: z.object({
          call_id: z.string().min(1).max(255).optional(),
        }),
      },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listByTenant(user.tenant_id, req.query.call_id) };
    },
  );

  app.get(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_RECORDINGS_VIEW),
      schema: {
        params: UuidParamsSchema,
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.getById(req.params.id, user.tenant_id) };
      } catch (err) {
        if (err instanceof RecordingNotFoundError) {
          return sendNotFound(reply, err.message);
        }
        throw err;
      }
    },
  );

  app.get(
    '/:id/playback',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_RECORDINGS_VIEW),
      schema: {
        params: UuidParamsSchema,
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
          return sendNotFound(reply, err.message);
        }
        if (err instanceof RecordingPlaybackPathError) {
          return sendConflict(reply, err.message);
        }
        if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
          return sendNotFound(reply, 'Recording media file not found');
        }
        throw err;
      }
    },
  );

  app.post(
    '/:id/analysis-requests',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_RECORDINGS_VIEW),
      schema: {
        params: UuidParamsSchema,
        body: CreateRecordingAnalysisBodySchema,
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const request = await service.createAnalysisRequest(req.params.id, user.tenant_id, req.body);
        return reply.code(201).send({ data: request });
      } catch (err) {
        if (err instanceof RecordingNotFoundError) return sendNotFound(reply, err.message);
        throw err;
      }
    },
  );

  app.get(
    '/:id/analysis-requests',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_RECORDINGS_VIEW),
      schema: { params: UuidParamsSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.listAnalysisRequests(req.params.id, user.tenant_id) };
      } catch (err) {
        if (err instanceof RecordingNotFoundError) return sendNotFound(reply, err.message);
        throw err;
      }
    },
  );

  app.get(
    '/:id/analysis-requests/:requestId',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_RECORDINGS_VIEW),
      schema: {
        params: z.object({
          id: z.string().uuid(),
          requestId: z.string().uuid(),
        }),
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const request = await service.getAnalysisRequest(req.params.requestId, user.tenant_id);
        if (request.recording_id !== req.params.id) {
          return sendNotFound(reply, 'Recording analysis request not found');
        }
        return { data: request };
      } catch (err) {
        if (err instanceof RecordingNotFoundError) return sendNotFound(reply, err.message);
        throw err;
      }
    },
  );

  app.post(
    '/internal/ingest',
    {
      preHandler: authenticateRuntime,
      schema: {
        body: z.object({
          tenant_id: z.string().min(1),
          call_id: z.string().min(1),
          call_event_id: z.string().uuid().optional(),
          storage_path: z.string().min(1).max(2048),
          duration_secs: z.number().int().min(0).optional(),
          size_bytes: z.number().int().min(0).optional(),
          recorded_at: z.string().datetime().optional(),
        }),
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
};

export const recordingAnalysisController: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/internal/:requestId/claim',
    {
      preHandler: authenticateRuntime,
      schema: {
        params: z.object({ requestId: z.string().uuid() }),
        body: z.object({
          processor_id: z.string().max(255).optional(),
        }),
      },
    },
    async (req, reply) => {
      try {
        return { data: await service.claimAnalysisRequest(req.params.requestId, req.body) };
      } catch (err) {
        if (err instanceof RecordingNotFoundError) return sendNotFound(reply, err.message);
        throw err;
      }
    },
  );

  app.post(
    '/internal/:requestId/result',
    {
      preHandler: authenticateRuntime,
      schema: {
        params: z.object({ requestId: z.string().uuid() }),
        body: z.object({
          status: z.enum(['completed', 'failed']),
          language: z.string().max(32).optional(),
          transcript_text: z.string().max(100000).optional(),
          summary_text: z.string().max(10000).optional(),
          error_message: z.string().max(500).optional(),
          provider_metadata: z.record(z.unknown()).optional(),
        }),
      },
    },
    async (req, reply) => {
      try {
        return { data: await service.completeAnalysisRequest(req.params.requestId, req.body) };
      } catch (err) {
        if (err instanceof RecordingNotFoundError) return sendNotFound(reply, err.message);
        throw err;
      }
    },
  );
};
