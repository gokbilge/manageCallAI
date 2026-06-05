import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { sendNotFound, sendInvalidArgument } from '../../errors/index.js';
import { RouteRiskAnalysisRequestSchema } from '@managecallai/contracts';
import { RiskAnalysisRepository } from './risk-analysis.repository.js';
import {
  RouteRiskAnalysisService,
  RiskAnalysisTargetNotFoundError,
  RiskAnalysisUnsupportedTargetError,
} from './risk-analysis.service.js';

const service = new RouteRiskAnalysisService(new RiskAnalysisRepository(db));

function replyError(err: unknown, reply: FastifyReply): void {
  if (err instanceof RiskAnalysisTargetNotFoundError) return sendNotFound(reply, err.message);
  if (err instanceof RiskAnalysisUnsupportedTargetError) return sendInvalidArgument(reply, err.message);
  throw err;
}

export const riskAnalysisController: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/route',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_RISK_ANALYSIS),
      schema: { body: RouteRiskAnalysisRequestSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const analysis = await service.analyze(req.body.target_type, req.body.target_id, user.tenant_id);
        return { data: analysis };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );
};
