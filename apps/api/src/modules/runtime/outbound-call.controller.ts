import type { FastifyInstance, FastifyReply } from 'fastify';
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
import type { CreateOutboundCallInput } from './outbound-call.types.js';

const service = new OutboundCallService(new OutboundCallRepository(db));

function replyOutboundError(err: unknown, reply: FastifyReply): FastifyReply {
  if (err instanceof OutboundCallNotFoundError) {
    return reply.code(404).send({ error: err.message });
  }
  if (err instanceof OutboundCallValidationError) {
    return reply.code(422).send({ error: err.message });
  }
  throw err;
}

export async function outboundCallController(app: FastifyInstance): Promise<void> {
  app.post<{ Body: Omit<CreateOutboundCallInput, 'tenant_id'> }>(
    '/outbound',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_OUTBOUND_CALLS_CREATE),
      schema: {
        body: {
          type: 'object',
          required: ['extension_id', 'dial_number'],
          additionalProperties: false,
          properties: {
            extension_id: { type: 'string', format: 'uuid' },
            dial_number: { type: 'string', minLength: 3, maxLength: 30 },
            route_id: { type: 'string', format: 'uuid' },
          },
        },
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
    '/outbound/pending',
    { preHandler: authenticateRuntime },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.getPendingByTenant(user.tenant_id) };
    },
  );

  app.post<{ Params: { id: string }; Body: { status: 'dispatched' | 'failed' } }>(
    '/outbound/:id/status',
    {
      preHandler: authenticateRuntime,
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
        body: {
          type: 'object',
          required: ['status'],
          additionalProperties: false,
          properties: { status: { type: 'string', enum: ['dispatched', 'failed'] } },
        },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.updateStatus(req.params.id, user.tenant_id, req.body.status) };
      } catch (err) {
        return replyOutboundError(err, reply);
      }
    },
  );
}
