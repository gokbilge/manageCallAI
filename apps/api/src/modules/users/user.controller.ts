import type { FastifyInstance, FastifyReply } from 'fastify';
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

const service = new UserService(new UserRepository(db));

function replyError(err: unknown, reply: FastifyReply): FastifyReply {
  if (err instanceof UserNotFoundError) {
    return reply.code(404).send({ error: err.message });
  }
  if (err instanceof UserConflictError) {
    return reply.code(409).send({ error: err.message });
  }
  if (err instanceof UserOperationForbiddenError) {
    return reply.code(403).send({ error: err.message });
  }
  throw err;
}

export async function userController(app: FastifyInstance): Promise<void> {
  app.get(
    '/',
    { preHandler: requireCapability(CAPABILITIES.TENANT_USERS_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listByTenant(user.tenant_id) };
    },
  );

  app.get<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_USERS_VIEW),
      schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
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

  app.post<{ Body: { email: string; display_name: string; role: string; password: string } }>(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_USERS_MANAGE),
      schema: {
        body: {
          type: 'object',
          required: ['email', 'display_name', 'role', 'password'],
          additionalProperties: false,
          properties: {
            email: { type: 'string', pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$', maxLength: 254 },
            display_name: { type: 'string', minLength: 1, maxLength: 255 },
            role: { type: 'string', enum: ['tenant_admin', 'tenant_operator', 'tenant_viewer'] },
            password: { type: 'string', minLength: 8, maxLength: 128 },
          },
        },
      },
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

  app.patch<{ Params: { id: string }; Body: { display_name?: string; role?: TenantRole } }>(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_USERS_MANAGE),
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          additionalProperties: false,
          minProperties: 1,
          properties: {
            display_name: { type: 'string', minLength: 1, maxLength: 255 },
            role: { type: 'string', enum: ['tenant_admin', 'tenant_operator', 'tenant_viewer'] },
          },
        },
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

  app.delete<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_USERS_MANAGE),
      schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
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
}
