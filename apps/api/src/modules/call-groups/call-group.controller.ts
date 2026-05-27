import type { FastifyInstance, FastifyReply } from 'fastify';
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
import type { AddMemberInput, CreateCallGroupInput, UpdateCallGroupInput } from './call-group.types.js';

const service = new CallGroupService(new CallGroupRepository(db));

function replyError(err: unknown, reply: FastifyReply): FastifyReply {
  if (err instanceof CallGroupNotFoundError || err instanceof CallGroupMemberNotFoundError) {
    return reply.code(404).send({ error: err.message });
  }
  if (err instanceof CallGroupMemberInvalidError) {
    return reply.code(422).send({ error: err.message });
  }
  throw err;
}

export async function callGroupController(app: FastifyInstance): Promise<void> {
  app.get(
    '/',
    { preHandler: requireCapability(CAPABILITIES.TENANT_CALL_GROUPS_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listByTenant(user.tenant_id) };
    },
  );

  app.post<{ Body: Omit<CreateCallGroupInput, 'tenant_id'> }>(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CALL_GROUPS_CREATE),
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string', maxLength: 1000 },
            strategy: { type: 'string', enum: ['simultaneous', 'sequential'] },
          },
        },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      const group = await service.create({ ...req.body, tenant_id: user.tenant_id });
      return reply.code(201).send({ data: group });
    },
  );

  app.get<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CALL_GROUPS_VIEW),
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

  app.patch<{ Params: { id: string }; Body: UpdateCallGroupInput }>(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CALL_GROUPS_UPDATE),
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            description: { anyOf: [{ type: 'string', maxLength: 1000 }, { type: 'null' }] },
            strategy: { type: 'string', enum: ['simultaneous', 'sequential'] },
            status: { type: 'string', enum: ['active', 'inactive'] },
          },
        },
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

  app.post<{ Params: { id: string } }>(
    '/:id/deactivate',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CALL_GROUPS_DEACTIVATE),
      schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
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

  app.post<{ Params: { id: string }; Body: AddMemberInput }>(
    '/:id/members',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CALL_GROUPS_UPDATE),
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          required: ['extension_id'],
          additionalProperties: false,
          properties: {
            extension_id: { type: 'string', format: 'uuid' },
            position: { type: 'integer', minimum: 0 },
          },
        },
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

  app.delete<{ Params: { id: string; extensionId: string } }>(
    '/:id/members/:extensionId',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CALL_GROUPS_UPDATE),
      schema: {
        params: {
          type: 'object',
          required: ['id', 'extensionId'],
          properties: { id: { type: 'string' }, extensionId: { type: 'string' } },
        },
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
}
