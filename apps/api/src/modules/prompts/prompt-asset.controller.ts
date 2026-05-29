import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { CreatePromptAssetBodySchema, UpdatePromptAssetBodySchema, UuidParamsSchema } from '@managecallai/contracts';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { PromptAssetRepository } from './prompt-asset.repository.js';
import { PromptAssetNotFoundError, PromptAssetService } from './prompt-asset.service.js';
import { sendNotFound } from '../../errors/index.js';

const service = new PromptAssetService(new PromptAssetRepository(db));

function replyNotFound(err: unknown, reply: FastifyReply): void {
  if (err instanceof PromptAssetNotFoundError) {
    return sendNotFound(reply, err.message);
  }
  throw err;
}

export const promptAssetController: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/',
    { preHandler: requireCapability(CAPABILITIES.TENANT_PROMPTS_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listByTenant(user.tenant_id) };
    },
  );

  app.post(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_PROMPTS_CREATE),
      schema: { body: CreatePromptAssetBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      const prompt = await service.create({
        tenant_id: user.tenant_id,
        name: req.body.name,
        media_type: req.body.media_type,
        language: req.body.language,
        storage_uri: req.body.storage_uri,
        checksum: req.body.checksum,
      });
      return reply.code(201).send({ data: prompt });
    },
  );

  app.get(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_PROMPTS_VIEW),
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
      preHandler: requireCapability(CAPABILITIES.TENANT_PROMPTS_UPDATE),
      schema: {
        params: UuidParamsSchema,
        body: UpdatePromptAssetBodySchema,
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
      preHandler: requireCapability(CAPABILITIES.TENANT_PROMPTS_DEACTIVATE),
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
