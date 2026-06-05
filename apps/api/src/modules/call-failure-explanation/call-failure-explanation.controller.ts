import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { sendNotFound } from '../../errors/index.js';
import { CallFailureExplainRequestSchema } from '@managecallai/contracts';
import { CallFailureExplanationRepository } from './call-failure-explanation.repository.js';
import { CallFailureExplanationService, CallNotFoundError } from './call-failure-explanation.service.js';

const service = new CallFailureExplanationService(new CallFailureExplanationRepository(db));

function replyError(err: unknown, reply: FastifyReply): void {
  if (err instanceof CallNotFoundError) return sendNotFound(reply, err.message);
  throw err;
}

export const callFailureExplanationController: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/explain-failure',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CALL_FAILURE_EXPLAIN),
      schema: { body: CallFailureExplainRequestSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const result = await service.explain(req.body.call_id, user.tenant_id);
        return { data: result };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );
};
