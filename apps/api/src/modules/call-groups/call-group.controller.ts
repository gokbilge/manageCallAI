import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { CallGroupRepository } from './call-group.repository.js';
import {
  CallGroupMemberInvalidError,
  CallGroupMemberNotFoundError,
  CallGroupNotFoundError,
  CallGroupService,
} from './call-group.service.js';
import { sendNotFound, sendInvalidArgument } from '../../errors/index.js';
import {
  UuidParamsSchema,
  CreateCallGroupBodySchema,
  UpdateCallGroupBodySchema,
  AddCallGroupMemberBodySchema,
} from '@managecallai/contracts';

const service = new CallGroupService(new CallGroupRepository(db));

function replyError(err: unknown, reply: FastifyReply): void {
  if (err instanceof CallGroupNotFoundError || err instanceof CallGroupMemberNotFoundError) {
    return sendNotFound(reply, err.message);
  }
  if (err instanceof CallGroupMemberInvalidError) {
    return sendInvalidArgument(reply, err.message);
  }
  throw err;
}

export const callGroupController: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/',
    { preHandler: requireCapability(CAPABILITIES.TENANT_CALL_GROUPS_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listByTenant(user.tenant_id) };
    },
  );

  app.post(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CALL_GROUPS_CREATE),
      schema: {
        body: CreateCallGroupBodySchema,
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      const group = await service.create({ ...req.body, tenant_id: user.tenant_id });
      return reply.code(201).send({ data: group });
    },
  );

  app.get(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CALL_GROUPS_VIEW),
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

  app.patch(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CALL_GROUPS_UPDATE),
      schema: {
        params: UuidParamsSchema,
        body: UpdateCallGroupBodySchema,
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.update(req.params.id, user.tenant_id, req.body) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.post(
    '/:id/deactivate',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CALL_GROUPS_DEACTIVATE),
      schema: { params: UuidParamsSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.deactivate(req.params.id, user.tenant_id) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.post(
    '/:id/members',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CALL_GROUPS_UPDATE),
      schema: {
        params: UuidParamsSchema,
        body: AddCallGroupMemberBodySchema,
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const member = await service.addMember(req.params.id, user.tenant_id, req.body);
        return reply.code(201).send({ data: member });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.delete(
    '/:id/members/:extensionId',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CALL_GROUPS_UPDATE),
      schema: {
        params: z.object({ id: z.string().uuid(), extensionId: z.string().uuid() }),
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        await service.removeMember(req.params.id, req.params.extensionId, user.tenant_id);
        return reply.code(204).send();
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );
};
