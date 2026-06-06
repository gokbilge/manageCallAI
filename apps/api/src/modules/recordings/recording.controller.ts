import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { UuidParamsSchema, CreateRecordingAnalysisBodySchema, SummaryReviewSchema } from '@managecallai/contracts';
import { db } from '../../db/client.js';
import { config } from '../../config/env.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES, hasCapability } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { fireAuditEvent } from '../audit/fire-audit.js';
import { AiPolicyRepository } from '../ai-policy/ai-policy.repository.js';
import { AiPolicyService, AiProviderRequestDeniedError } from '../ai-policy/ai-policy.service.js';
import { fireWebhooks } from '../automation/webhook-delivery.js';
import { authenticateRuntime } from '../runtime/runtime-auth.js';
import { RecordingRepository } from './recording.repository.js';
import { RecordingNotFoundError, RecordingPlaybackPathError, RecordingService } from './recording.service.js';
import { sendNotFound, sendFailedPrecondition, sendPermissionDenied } from '../../errors/index.js';

const aiPolicyService = new AiPolicyService(new AiPolicyRepository(db));
const service = new RecordingService(new RecordingRepository(db), config.recordingStorageRoot, aiPolicyService);

function canViewTranscript(user: AuthClaims): boolean {
  if (user.capabilities !== undefined) {
    return user.capabilities.includes('*') || user.capabilities.includes(CAPABILITIES.TENANT_COMPLIANCE_ADMIN);
  }
  return hasCapability(user.role, CAPABILITIES.TENANT_COMPLIANCE_ADMIN);
}

function canUseProviderBackedAi(user: AuthClaims): boolean {
  if (user.capabilities !== undefined) {
    return user.capabilities.includes('*') || user.capabilities.includes(CAPABILITIES.TENANT_AI_PROVIDER_BACKED_USE);
  }
  return user.role === 'tenant_admin' || user.role === 'tenant_operator' || user.role === 'platform_admin';
}

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
    '/:id/summary-review',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_RECORDINGS_VIEW),
      schema: {
        params: UuidParamsSchema,
        response: { 200: z.object({ data: SummaryReviewSchema }) },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return {
          data: await service.getSummaryReviewForRecording(req.params.id, user.tenant_id, {
            canViewTranscript: canViewTranscript(user),
          }),
        };
      } catch (err) {
        if (err instanceof RecordingNotFoundError) {
          return sendNotFound(reply, err.message);
        }
        throw err;
      }
    },
  );

  app.get(
    '/summary-review/by-call/:callId',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_RECORDINGS_VIEW),
      schema: {
        params: z.object({ callId: z.string().min(1).max(255) }),
        response: { 200: z.object({ data: SummaryReviewSchema }) },
      },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      return {
        data: await service.getSummaryReviewForCall(req.params.callId, user.tenant_id, {
          canViewTranscript: canViewTranscript(user),
        }),
      };
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
          return sendFailedPrecondition(reply, err.message);
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
      if ((req.body.provider_hint ?? 'auto') !== 'auto' && !canUseProviderBackedAi(user)) {
        return sendPermissionDenied(reply, 'Provider-backed AI use requires tenant.ai.provider_backed.use');
      }
      try {
        const request = await service.createAnalysisRequest(req.params.id, user.tenant_id, req.body);
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role ?? null,
          action: 'recording.analysis_requested',
          resource_type: 'recording_analysis_request',
          resource_id: request.id,
          metadata: {
            recording_id: request.recording_id,
            requested_outputs: request.requested_outputs,
            provider_hint: request.provider_hint,
            source_mode: request.source_mode,
            transcript_status: request.transcript_status,
            summary_status: request.summary_status,
            policy: request.metadata['ai_policy'] ?? null,
          },
        });
        return reply.code(201).send({ data: request });
      } catch (err) {
        if (err instanceof RecordingNotFoundError) return sendNotFound(reply, err.message);
        if (err instanceof AiProviderRequestDeniedError) return sendFailedPrecondition(reply, err.message);
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

  // ── SLICE-47: Retention policy ────────────────────────────────────────────

  app.get(
    '/retention-policy',
    { preHandler: requireCapability(CAPABILITIES.TENANT_COMPLIANCE_ADMIN) },
    async (req) => {
      const user = req.user as AuthClaims;
      const policy = await service.getRetentionPolicy(user.tenant_id);
      return { data: policy };
    },
  );

  app.put(
    '/retention-policy',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_COMPLIANCE_ADMIN),
      schema: {
        body: z.object({
          recording_retention_days: z.number().int().positive().nullable().optional(),
          voicemail_retention_days: z.number().int().positive().nullable().optional(),
          transcript_retention_days: z.number().int().positive().nullable().optional(),
          ai_summary_retention_days: z.number().int().positive().nullable().optional(),
          cdr_retention_days: z.number().int().positive().nullable().optional(),
          call_event_retention_days: z.number().int().positive().nullable().optional(),
          generated_media_retention_days: z.number().int().positive().nullable().optional(),
        }),
      },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      const policy = await service.updateRetentionPolicy(user.tenant_id, req.body);
      return { data: policy };
    },
  );

  // ── SLICE-47: Legal holds ─────────────────────────────────────────────────

  app.post(
    '/legal-holds',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_COMPLIANCE_ADMIN),
      schema: {
        body: z.object({
          resource_type: z.enum(['recording', 'voicemail', 'transcript', 'summary', 'cdr', 'call_event', 'generated_media', 'all']),
          resource_id: z.string().max(255).nullable().optional(),
          case_reference: z.string().max(255).nullable().optional(),
          reason: z.string().min(1).max(2000),
          expires_at: z.string().datetime().nullable().optional(),
        }),
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      const hold = await service.createLegalHold(user.tenant_id, user.sub, req.body);
      return reply.code(201).send({ data: hold });
    },
  );

  app.get(
    '/legal-holds',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_COMPLIANCE_ADMIN),
      schema: {
        querystring: z.object({
          resource_type: z.enum(['recording', 'voicemail', 'transcript', 'summary', 'cdr', 'call_event', 'generated_media', 'all']).optional(),
          status: z.enum(['active', 'released', 'expired']).optional(),
        }),
      },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      const holds = await service.listLegalHolds(user.tenant_id, req.query);
      return { data: holds };
    },
  );

  app.get(
    '/legal-holds/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_COMPLIANCE_ADMIN),
      schema: { params: UuidParamsSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.getLegalHold(req.params.id, user.tenant_id) };
      } catch (err) {
        if (err instanceof RecordingNotFoundError) return sendNotFound(reply, err.message);
        throw err;
      }
    },
  );

  app.post(
    '/legal-holds/:id/release',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_COMPLIANCE_ADMIN),
      schema: { params: UuidParamsSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const hold = await service.releaseLegalHold(req.params.id, user.tenant_id, user.sub);
        return { data: hold };
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
        const request = await service.completeAnalysisRequest(req.params.requestId, req.body);
        fireAuditEvent({
          tenant_id: request.tenant_id,
          actor_id: null,
          actor_role: 'system',
          action: req.body.status === 'completed' ? 'recording.analysis_completed' : 'recording.analysis_failed',
          resource_type: 'recording_analysis_request',
          resource_id: request.id,
          metadata: {
            recording_id: request.recording_id,
            provider_hint: request.provider_hint,
            source_mode: request.source_mode,
            transcript_status: request.transcript_status,
            summary_status: request.summary_status,
            provider_metadata: request.provider_metadata,
            error_message: request.error_message,
          },
        });
        return { data: request };
      } catch (err) {
        if (err instanceof RecordingNotFoundError) return sendNotFound(reply, err.message);
        throw err;
      }
    },
  );
};
