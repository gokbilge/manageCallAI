import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  CreatePromptGenerationBodySchema,
  CompletePromptGenerationBodySchema,
  ClaimWorkRequestBodySchema,
  CreateIvrAiTurnBodySchema,
  CompleteIvrAiTurnBodySchema,
  CompleteIvrGenerationBodySchema,
  CompleteIvrAiPatchBodySchema,
} from '@managecallai/contracts';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { authenticateRuntime } from '../runtime/runtime-auth.js';
import { fireAuditEvent } from '../audit/fire-audit.js';
import { AiPolicyRepository } from '../ai-policy/ai-policy.repository.js';
import { AiPolicyService, AiProviderRequestDeniedError } from '../ai-policy/ai-policy.service.js';
import { ProviderWorkRepository } from './provider-work.repository.js';
import { ProviderWorkRequestNotFoundError, ProviderWorkService } from './provider-work.service.js';
import { sendNotFound, sendInvalidArgument, sendFailedPrecondition, sendPermissionDenied } from '../../errors/index.js';

const aiPolicyService = new AiPolicyService(new AiPolicyRepository(db));
const service = new ProviderWorkService(new ProviderWorkRepository(db), aiPolicyService);

function replyNotFound(err: unknown, reply: FastifyReply): void {
  if (err instanceof ProviderWorkRequestNotFoundError) {
    return sendNotFound(reply, err.message);
  }
  if (err instanceof AiProviderRequestDeniedError) {
    return sendFailedPrecondition(reply, err.message);
  }
  throw err;
}

export const promptGenerationController: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/requests',
    { preHandler: requireCapability(CAPABILITIES.TENANT_PROMPTS_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listPromptGenerations(user.tenant_id) };
    },
  );

  app.post(
    '/requests',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_PROMPTS_CREATE),
      schema: {
        body: CreatePromptGenerationBodySchema,
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      if ((req.body.provider_hint ?? 'auto') !== 'auto') {
        const capabilities = user.capabilities;
        const canUseProviderBacked = capabilities !== undefined
          ? (capabilities.includes('*') || capabilities.includes(CAPABILITIES.TENANT_AI_PROVIDER_BACKED_USE))
          : requireProviderBackedCapability(user.role);
        if (!canUseProviderBacked) {
          return sendPermissionDenied(reply, 'Provider-backed AI use requires tenant.ai.provider_backed.use');
        }
      }
      try {
        const request = await service.createPromptGeneration(user.tenant_id, req.body);
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role ?? null,
          action: 'ai.prompt_generation.requested',
          resource_type: 'prompt_generation_request',
          resource_id: request.id,
          metadata: {
            provider_hint: request.provider_hint,
            requested_outputs: request.requested_outputs,
            policy: request.metadata['ai_policy'] ?? null,
          },
        });
        return reply.code(201).send({ data: request });
      } catch (err) {
        return replyNotFound(err, reply);
      }
    },
  );

  app.get(
    '/requests/:requestId',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_PROMPTS_VIEW),
      schema: {
        params: z.object({ requestId: z.string() }),
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.getPromptGeneration(req.params.requestId, user.tenant_id) };
      } catch (err) {
        return replyNotFound(err, reply);
      }
    },
  );

  app.post(
    '/internal/:requestId/claim',
    {
      preHandler: authenticateRuntime,
      schema: {
        params: z.object({ requestId: z.string() }),
        body: ClaimWorkRequestBodySchema,
      },
    },
    async (req, reply) => {
      try {
        return { data: await service.claimPromptGeneration(req.params.requestId, req.body) };
      } catch (err) {
        return replyNotFound(err, reply);
      }
    },
  );

  app.post(
    '/internal/:requestId/result',
    {
      preHandler: authenticateRuntime,
      schema: {
        params: z.object({ requestId: z.string() }),
        body: CompletePromptGenerationBodySchema,
      },
    },
    async (req, reply) => {
      try {
        return { data: await service.completePromptGeneration(req.params.requestId, req.body) };
      } catch (err) {
        return replyNotFound(err, reply);
      }
    },
  );
};

export const ivrAiController: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/runtime/ivr-ai/turns',
    {
      preHandler: authenticateRuntime,
      schema: {
        body: CreateIvrAiTurnBodySchema.extend({ tenant_id: z.string().min(1).optional() }),
      },
    },
    async (req, reply) => {
      const tenantId = req.body.tenant_id ?? '';
      if (!tenantId) return sendInvalidArgument(reply, 'tenant_id is required for runtime IVR AI turns');
      const request = await service.createIvrAiTurn(tenantId, req.body);
      fireAuditEvent({
        tenant_id: tenantId,
        actor_id: null,
        actor_role: 'system',
        action: 'ai.ivr_turn.requested',
        resource_type: 'ivr_ai_turn_request',
        resource_id: request.id,
        metadata: {
          provider_hint: request.provider_hint,
          requested_outputs: request.requested_outputs,
          policy: request.metadata['ai_policy'] ?? null,
        },
      });
      return reply.code(201).send({ data: request });
    },
  );

  app.get(
    '/runtime/ivr-ai/turns/:requestId',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_VIEW),
      schema: {
        params: z.object({ requestId: z.string() }),
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.getIvrAiTurn(req.params.requestId, user.tenant_id) };
      } catch (err) {
        return replyNotFound(err, reply);
      }
    },
  );

  app.post(
    '/ivr-ai/internal/:requestId/claim',
    {
      preHandler: authenticateRuntime,
      schema: {
        params: z.object({ requestId: z.string() }),
        body: ClaimWorkRequestBodySchema,
      },
    },
    async (req, reply) => {
      try {
        return { data: await service.claimIvrAiTurn(req.params.requestId, req.body) };
      } catch (err) {
        return replyNotFound(err, reply);
      }
    },
  );

  app.post(
    '/ivr-ai/internal/:requestId/result',
    {
      preHandler: authenticateRuntime,
      schema: {
        params: z.object({ requestId: z.string() }),
        body: CompleteIvrAiTurnBodySchema,
      },
    },
    async (req, reply) => {
      try {
        return { data: await service.completeIvrAiTurn(req.params.requestId, req.body) };
      } catch (err) {
        return replyNotFound(err, reply);
      }
    },
  );
};

function requireProviderBackedCapability(role: AuthClaims['role']): boolean {
  return role === 'tenant_admin' || role === 'tenant_operator' || role === 'platform_admin';
}

export const ivrGenerationWorkerController: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/ivr-generation/internal/:requestId/claim',
    {
      preHandler: authenticateRuntime,
      schema: {
        params: z.object({ requestId: z.string() }),
        body: ClaimWorkRequestBodySchema,
      },
    },
    async (req, reply) => {
      try {
        return { data: await service.claimIvrGeneration(req.params.requestId, req.body) };
      } catch (err) {
        return replyNotFound(err, reply);
      }
    },
  );

  app.post(
    '/ivr-generation/internal/:requestId/result',
    {
      preHandler: authenticateRuntime,
      schema: {
        params: z.object({ requestId: z.string() }),
        body: CompleteIvrGenerationBodySchema,
      },
    },
    async (req, reply) => {
      try {
        return { data: await service.completeIvrGeneration(req.params.requestId, req.body) };
      } catch (err) {
        return replyNotFound(err, reply);
      }
    },
  );
};

export const ivrAiPatchWorkerController: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/ivr-ai-patches/internal/:requestId/claim',
    {
      preHandler: authenticateRuntime,
      schema: {
        params: z.object({ requestId: z.string() }),
        body: ClaimWorkRequestBodySchema,
      },
    },
    async (req, reply) => {
      try {
        return { data: await service.claimIvrAiPatch(req.params.requestId, req.body) };
      } catch (err) {
        return replyNotFound(err, reply);
      }
    },
  );

  app.post(
    '/ivr-ai-patches/internal/:requestId/result',
    {
      preHandler: authenticateRuntime,
      schema: {
        params: z.object({ requestId: z.string() }),
        body: CompleteIvrAiPatchBodySchema,
      },
    },
    async (req, reply) => {
      try {
        return { data: await service.completeIvrAiPatch(req.params.requestId, req.body) };
      } catch (err) {
        return replyNotFound(err, reply);
      }
    },
  );
};
