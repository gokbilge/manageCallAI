import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  PlatformAiPolicySchema,
  TenantAiPolicySchema,
  UpdatePlatformAiPolicyBodySchema,
  UpdateTenantAiPolicyBodySchema,
} from '@managecallai/contracts';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { authenticatePlatform } from '../platform/authenticate-platform.js';
import { fireAuditEvent } from '../audit/fire-audit.js';
import { sendInvalidArgument } from '../../errors/index.js';
import { AiPolicyRepository } from './ai-policy.repository.js';
import { AiPolicyService, AiPolicyValidationError } from './ai-policy.service.js';
import type { UpdatePlatformAiPolicyInput, UpdateTenantAiPolicyInput } from './ai-policy.types.js';

const service = new AiPolicyService(new AiPolicyRepository(db));

function replyError(err: unknown, reply: FastifyReply): void {
  if (err instanceof AiPolicyValidationError) {
    return sendInvalidArgument(reply, err.message);
  }
  throw err;
}

export const platformAiPolicyController: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', authenticatePlatform);

  app.get(
    '/ai-policy',
    {
      schema: {
        response: { 200: z.object({ data: PlatformAiPolicySchema }) },
      },
    },
    async () => ({ data: await service.getPlatformPolicy() }),
  );

  app.put(
    '/ai-policy',
    {
      schema: {
        body: UpdatePlatformAiPolicyBodySchema,
        response: { 200: z.object({ data: PlatformAiPolicySchema }) },
      },
    },
    async (req, reply) => {
      const actor = req.user as AuthClaims;
      try {
        const policy = await service.updatePlatformPolicy(req.body as UpdatePlatformAiPolicyInput, actor);
        return reply.send({ data: policy });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );
};

export const tenantAiPolicyController: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/ai-policy',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_AI_POLICY_VIEW),
      schema: {
        response: { 200: z.object({ data: TenantAiPolicySchema }) },
      },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.getTenantPolicy(user.tenant_id) };
    },
  );

  app.put(
    '/ai-policy',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_AI_POLICY_MANAGE),
      schema: {
        body: UpdateTenantAiPolicyBodySchema,
        response: { 200: z.object({ data: TenantAiPolicySchema }) },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const policy = await service.updateTenantPolicy(user.tenant_id, req.body as UpdateTenantAiPolicyInput);
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role ?? null,
          action: 'tenant.ai_policy.updated',
          resource_type: 'tenant_ai_policy',
          resource_id: user.tenant_id,
          metadata: {
            provider_backed_enabled: policy.provider_backed_enabled,
            prompt_generation_enabled: policy.feature_policies.prompt_generation.enabled,
            ivr_ai_turn_enabled: policy.feature_policies.ivr_ai_turn.enabled,
            recording_analysis_enabled: policy.feature_policies.recording_analysis.enabled,
          },
        });
        return reply.send({ data: policy });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );
};
