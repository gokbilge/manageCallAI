import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { CreateExtensionBodySchema, UpdateExtensionBodySchema, UuidParamsSchema } from '@managecallai/contracts';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { ExtensionRepository } from './extension.repository.js';
import { ExtensionNotFoundError, ExtensionService } from './extension.service.js';
import { sendNotFound } from '../../errors/index.js';

const service = new ExtensionService(new ExtensionRepository(db));

function replyNotFound(err: unknown, reply: FastifyReply): void {
  if (err instanceof ExtensionNotFoundError) {
    return sendNotFound(reply, err.message);
  }
  throw err;
}

export const extensionController: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/',
    { preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      const extensions = await service.listByTenant(user.tenant_id);
      return { data: extensions };
    },
  );

  app.post(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_CREATE),
      schema: { body: CreateExtensionBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      const ext = await service.create({
        ...req.body,
        tenant_id: user.tenant_id,
        owner_user_id: user.sub,
      });
      return reply.code(201).send({ data: ext });
    },
  );

  app.get(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_VIEW),
      schema: { params: UuidParamsSchema },
    },
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
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_UPDATE),
      schema: {
        params: UuidParamsSchema,
        body: UpdateExtensionBodySchema,
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.update(req.params.id, user.tenant_id, req.body) };
      } catch (err) {
        return replyNotFound(err, reply);
      }
    },
  );

  app.post(
    '/:id/deactivate',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_DEACTIVATE),
      schema: { params: UuidParamsSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.deactivate(req.params.id, user.tenant_id) };
      } catch (err) {
        return replyNotFound(err, reply);
      }
    },
  );
};
