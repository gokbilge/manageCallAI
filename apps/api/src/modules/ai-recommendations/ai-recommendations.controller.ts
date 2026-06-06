import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { UuidParamsSchema } from '@managecallai/contracts';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { fireAuditEvent } from '../audit/fire-audit.js';
import { sendNotFound, sendFailedPrecondition } from '../../errors/index.js';
import { AiRecommendationRepository } from './ai-recommendations.repository.js';
import {
  AiRecommendationService,
  AiRecommendationNotFoundError,
  AiRecommendationStateError,
  AiRecommendationTargetNotFoundError,
} from './ai-recommendations.service.js';
import type { AiRecommendationTargetType } from './ai-recommendations.types.js';

const service = new AiRecommendationService(new AiRecommendationRepository(db));

const CreateRecommendationBodySchema = z.object({
  target_type: z.enum(['inbound_route', 'outbound_route', 'fraud_policy']),
  target_id: z.string().uuid().optional(),
  intent: z.string().min(1).max(4000),
  metadata: z.record(z.unknown()).optional(),
});

function replyError(err: unknown, reply: FastifyReply): void {
  if (err instanceof AiRecommendationNotFoundError || err instanceof AiRecommendationTargetNotFoundError) {
    return sendNotFound(reply, (err as Error).message);
  }
  if (err instanceof AiRecommendationStateError) {
    return sendFailedPrecondition(reply, (err as Error).message);
  }
  throw err;
}

export const aiRecommendationsController: FastifyPluginAsyncZod = async (app) => {
  // List recommendations (optionally filter by target_type)
  app.get(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_RISK_ANALYSIS),
      schema: {
        querystring: z.object({ target_type: z.enum(['inbound_route', 'outbound_route', 'fraud_policy']).optional() }),
      },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      const { target_type } = req.query as { target_type?: AiRecommendationTargetType };
      return { data: await service.list(user.tenant_id, target_type) };
    },
  );

  // Get a specific recommendation
  app.get(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_RISK_ANALYSIS),
      schema: { params: UuidParamsSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.getById(req.params.id, user.tenant_id) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  // Create a recommendation (generates advisory suggestion immediately)
  app.post(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_RISK_ANALYSIS),
      schema: { body: CreateRecommendationBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const recommendation = await service.create(user.tenant_id, req.body);
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role ?? null,
          action: 'ai.recommendation.created',
          resource_type: 'ai_recommendation',
          resource_id: recommendation.id,
          metadata: {
            target_type: recommendation.target_type,
            target_id: recommendation.target_id,
            risk_level: recommendation.risk_level,
          },
        });
        return reply.code(201).send({ data: recommendation });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  // Accept a recommendation → creates draft (route) or updates policy (fraud)
  app.post(
    '/:id/accept',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_RISK_ANALYSIS),
      schema: { params: UuidParamsSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const result = await service.accept(req.params.id, user.tenant_id, user.sub, user.sub);
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role ?? null,
          action: 'ai.recommendation.accepted',
          resource_type: 'ai_recommendation',
          resource_id: req.params.id,
          metadata: {
            target_type: result.recommendation.target_type,
            draft_version_id: result.draft_version_id ?? null,
          },
        });
        return { data: result };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  // Reject a recommendation — no changes applied
  app.post(
    '/:id/reject',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_RISK_ANALYSIS),
      schema: { params: UuidParamsSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const rejected = await service.reject(req.params.id, user.tenant_id, user.sub);
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role ?? null,
          action: 'ai.recommendation.rejected',
          resource_type: 'ai_recommendation',
          resource_id: req.params.id,
          metadata: { target_type: rejected.target_type },
        });
        return { data: rejected };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );
};
