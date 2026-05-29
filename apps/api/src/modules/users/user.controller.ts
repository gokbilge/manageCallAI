import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { CreateUserBodySchema, UpdateUserBodySchema, UuidParamsSchema } from '@managecallai/contracts';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { fireAuditEvent } from '../audit/fire-audit.js';
import { UserRepository } from './user.repository.js';
import {
  UserConflictError,
  UserNotFoundError,
  UserOperationForbiddenError,
  UserService,
} from './user.service.js';
import type { TenantRole } from './user.types.js';
import { sendNotFound, sendAlreadyExists, sendPermissionDenied } from '../../errors/index.js';

const service = new UserService(new UserRepository(db));

function replyError(err: unknown, reply: FastifyReply): void {
  if (err instanceof UserNotFoundError) {
    return sendNotFound(reply, err.message);
  }
  if (err instanceof UserConflictError) {
    return sendAlreadyExists(reply, err.message);
  }
  if (err instanceof UserOperationForbiddenError) {
    return sendPermissionDenied(reply, err.message);
  }
  throw err;
}

export const userController: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/',
    { preHandler: requireCapability(CAPABILITIES.TENANT_USERS_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listByTenant(user.tenant_id) };
    },
  );

  app.get(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_USERS_VIEW),
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

  app.post(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_USERS_MANAGE),
      schema: { body: CreateUserBodySchema },
    },
    async (req, reply) => {
      const actor = req.user as AuthClaims;
      try {
        const created = await service.create(actor.tenant_id, req.body);
        fireAuditEvent({ tenant_id: actor.tenant_id, actor_id: actor.sub, actor_role: actor.role, action: 'user.created', resource_type: 'user', resource_id: created.id, metadata: { email: created.email, role: created.role } });
        return reply.code(201).send({ data: created });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.patch(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_USERS_MANAGE),
      schema: {
        params: UuidParamsSchema,
        body: UpdateUserBodySchema,
      },
    },
    async (req, reply) => {
      const actor = req.user as AuthClaims;
      try {
        const updated = await service.update(req.params.id, actor.tenant_id, actor.sub, req.body);
        if (req.body.role) {
          fireAuditEvent({ tenant_id: actor.tenant_id, actor_id: actor.sub, actor_role: actor.role, action: 'user.role_changed', resource_type: 'user', resource_id: updated.id, metadata: { new_role: updated.role } });
        }
        return { data: updated };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.delete(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_USERS_MANAGE),
      schema: { params: UuidParamsSchema },
    },
    async (req, reply) => {
      const actor = req.user as AuthClaims;
      try {
        const deactivated = await service.deactivate(req.params.id, actor.tenant_id, actor.sub);
        fireAuditEvent({ tenant_id: actor.tenant_id, actor_id: actor.sub, actor_role: actor.role, action: 'user.deactivated', resource_type: 'user', resource_id: deactivated.id });
        return { data: deactivated };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );
};
