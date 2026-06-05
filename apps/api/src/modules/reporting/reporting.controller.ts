import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { sendInvalidArgument } from '../../errors/index.js';
import { NlQueryRequestSchema } from '@managecallai/contracts';
import { ReportingRepository } from './reporting.repository.js';
import { NlReportingService, NlQueryNotSupportedError } from './reporting.service.js';

const service = new NlReportingService(new ReportingRepository(db));

function replyError(err: unknown, reply: FastifyReply): void {
  if (err instanceof NlQueryNotSupportedError) {
    return sendInvalidArgument(reply, err.message);
  }
  throw err;
}

export const reportingController: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/nl-query',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_NL_REPORTING),
      schema: { body: NlQueryRequestSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const result = await service.query(req.body.question, user.tenant_id);
        return { data: result };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );
};
