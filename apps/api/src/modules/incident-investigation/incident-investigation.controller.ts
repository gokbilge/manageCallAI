import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { UuidParamsSchema } from '@managecallai/contracts';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { fireAuditEvent } from '../audit/fire-audit.js';
import { sendNotFound } from '../../errors/index.js';
import { IncidentInvestigationRepository } from './incident-investigation.repository.js';
import {
  IncidentInvestigationService,
  IncidentInvestigationNotFoundError,
} from './incident-investigation.service.js';

const service = new IncidentInvestigationService(new IncidentInvestigationRepository(db));

const InvestigationContextSchema = z.object({
  call_ids: z.array(z.string()).optional(),
  route_ids: z.array(z.string().uuid()).optional(),
  time_range: z.object({
    from: z.string().datetime(),
    to: z.string().datetime(),
  }).optional(),
});

const InvestigateBodySchema = z.object({
  question: z.string().min(1).max(2000),
  context: InvestigationContextSchema.optional(),
});

function replyError(err: unknown, reply: FastifyReply): void {
  if (err instanceof IncidentInvestigationNotFoundError) {
    return sendNotFound(reply, (err as Error).message);
  }
  throw err;
}

export const incidentInvestigationController: FastifyPluginAsyncZod = async (app) => {
  // List past investigations
  app.get(
    '/',
    { preHandler: requireCapability(CAPABILITIES.TENANT_RISK_ANALYSIS) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.list(user.tenant_id) };
    },
  );

  // Get a specific investigation
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

  // Investigate — gathers facts and returns cited advisory answer (read-only)
  app.post(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_RISK_ANALYSIS),
      schema: { body: InvestigateBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      const capabilities = user.capabilities;
      const canViewRecordings = capabilities !== undefined
        ? (capabilities.includes('*') || capabilities.includes(CAPABILITIES.TENANT_RECORDINGS_VIEW))
        : (user.role === 'tenant_admin' || user.role === 'platform_admin');

      const investigation = await service.investigate(
        user.tenant_id,
        req.body.question,
        req.body.context ?? {},
        user.sub,
        canViewRecordings,
      );

      fireAuditEvent({
        tenant_id: user.tenant_id,
        actor_id: user.sub,
        actor_role: user.role ?? null,
        action: 'ai.incident_investigation.created',
        resource_type: 'incident_investigation',
        resource_id: investigation.id,
        metadata: {
          question_length: req.body.question.length,
          citation_count: investigation.citations.length,
          data_sources: investigation.data_sources,
        },
      });

      return reply.code(201).send({ data: investigation });
    },
  );
};
