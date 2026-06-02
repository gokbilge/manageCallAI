import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  CreateOutboundCallBodySchema,
  UuidParamsSchema,
} from '@managecallai/contracts';
import { z } from 'zod';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { authenticateRuntime } from './runtime-auth.js';
import { OutboundCallRepository } from './outbound-call.repository.js';
import {
  OutboundCallNotFoundError,
  OutboundCallService,
  OutboundCallValidationError,
} from './outbound-call.service.js';
import type { OutboundCallStatus } from './outbound-call.types.js';
import { sendNotFound, sendInvalidArgument } from '../../errors/index.js';
import { FraudRepository } from '../fraud/fraud.repository.js';
import { FraudService } from '../fraud/fraud.service.js';

const fraudService = new FraudService(new FraudRepository(db));
const service = new OutboundCallService(new OutboundCallRepository(db), fraudService);

function replyOutboundError(err: unknown, reply: FastifyReply): void {
  if (err instanceof OutboundCallNotFoundError) {
    return sendNotFound(reply, err.message);
  }
  if (err instanceof OutboundCallValidationError) {
    return sendInvalidArgument(reply, err.message);
  }
  throw err;
}

const TERMINAL_STATUSES = ['dispatched', 'answered', 'completed', 'failed', 'expired'] as const;

export const outboundCallController: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/outbound',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_OUTBOUND_CALLS_CREATE),
      schema: {
        body: CreateOutboundCallBodySchema,
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const request = await service.create({
          tenant_id: user.tenant_id,
          extension_id: req.body.extension_id,
          dial_number: req.body.dial_number,
          route_id: req.body.route_id,
        });
        return reply.code(201).send({ data: request });
      } catch (err) {
        return replyOutboundError(err, reply);
      }
    },
  );

  app.get(
    '/outbound',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_OUTBOUND_CALLS_VIEW),
      schema: {
        querystring: z.object({
          status: z.enum(['pending', 'dispatched', 'answered', 'completed', 'failed', 'expired']).optional(),
        }),
      },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listByTenant(user.tenant_id, req.query.status as OutboundCallStatus | undefined) };
    },
  );

  app.get(
    '/outbound/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_OUTBOUND_CALLS_VIEW),
      schema: {
        params: UuidParamsSchema,
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.getById(req.params.id, user.tenant_id) };
      } catch (err) {
        return replyOutboundError(err, reply);
      }
    },
  );

  app.get(
    '/outbound/pending',
    { preHandler: authenticateRuntime },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.getPendingByTenant(user.tenant_id) };
    },
  );

  app.post(
    '/outbound/:id/claim',
    {
      preHandler: authenticateRuntime,
      schema: {
        params: UuidParamsSchema,
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.claimRequest(req.params.id, user.tenant_id) };
      } catch (err) {
        return replyOutboundError(err, reply);
      }
    },
  );

  app.post(
    '/outbound/:id/status',
    {
      preHandler: authenticateRuntime,
      schema: {
        params: UuidParamsSchema,
        body: z.object({
          status: z.enum(TERMINAL_STATUSES),
          failure_reason: z.string().max(500).optional(),
        }),
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return {
          data: await service.updateStatus(
            req.params.id,
            user.tenant_id,
            req.body.status,
            req.body.failure_reason,
          ),
        };
      } catch (err) {
        return replyOutboundError(err, reply);
      }
    },
  );
};
