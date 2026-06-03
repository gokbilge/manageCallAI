import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { CreateSipTrunkBodySchema, UpdateSipTrunkBodySchema, UuidParamsSchema } from '@managecallai/contracts';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { authenticate } from '../auth/authenticate.js';
import { fireAuditEvent } from '../audit/fire-audit.js';
import { SipTrunkRepository } from './sip-trunk.repository.js';
import { SipTrunkNotFoundError, SipTrunkService } from './sip-trunk.service.js';
import { RuntimeApplyRepository } from './runtime-apply.repository.js';
import { RuntimeApplyService } from './runtime-apply.service.js';
import { sendNotFound } from '../../errors/index.js';

const applyService = new RuntimeApplyService(new RuntimeApplyRepository(db));
const service = new SipTrunkService(new SipTrunkRepository(db), applyService);

function replyNotFound(err: unknown, reply: FastifyReply): void {
  if (err instanceof SipTrunkNotFoundError) {
    return sendNotFound(reply, err.message);
  }
  throw err;
}

export const sipTrunkController: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', authenticate);

  app.get('/', async (req) => {
    const user = req.user as AuthClaims;
    return { data: await service.listByTenant(user.tenant_id) };
  });

  app.post(
    '/',
    { schema: { body: CreateSipTrunkBodySchema } },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      const { trunk, applyRequests } = await service.create({
        ...req.body,
        tenant_id: user.tenant_id,
        actorId: user.sub,
      });
      fireAuditEvent({
        tenant_id: user.tenant_id,
        actor_id: user.sub,
        actor_role: user.role,
        action: 'sip_trunk.created',
        resource_type: 'sip_trunk',
        resource_id: trunk.id,
      });
      return reply.code(201).send({ data: trunk, runtime_apply: applyRequests });
    },
  );

  app.get(
    '/:id',
    { schema: { params: UuidParamsSchema } },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.getById(req.params.id, user.tenant_id) };
      } catch (err) {
        return replyNotFound(err, reply);
      }
    },
  );

  app.patch(
    '/:id',
    { schema: { params: UuidParamsSchema, body: UpdateSipTrunkBodySchema } },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const { trunk, applyRequests } = await service.update(req.params.id, user.tenant_id, {
          ...req.body,
          actorId: user.sub,
        });
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role,
          action: 'sip_trunk.updated',
          resource_type: 'sip_trunk',
          resource_id: trunk.id,
        });
        return { data: trunk, runtime_apply: applyRequests };
      } catch (err) {
        return replyNotFound(err, reply);
      }
    },
  );

  app.post(
    '/:id/deactivate',
    { schema: { params: UuidParamsSchema } },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const { trunk, applyRequests } = await service.deactivate(req.params.id, user.tenant_id, user.sub);
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role,
          action: 'sip_trunk.deactivated',
          resource_type: 'sip_trunk',
          resource_id: trunk.id,
        });
        return { data: trunk, runtime_apply: applyRequests };
      } catch (err) {
        return replyNotFound(err, reply);
      }
    },
  );
};
