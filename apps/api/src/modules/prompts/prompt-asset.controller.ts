import type { FastifyInstance, FastifyReply } from 'fastify';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { PromptAssetRepository } from './prompt-asset.repository.js';
import { PromptAssetNotFoundError, PromptAssetService } from './prompt-asset.service.js';
import type {
  CreatePromptAssetInput,
  UpdatePromptAssetInput,
} from './prompt-asset.types.js';

const service = new PromptAssetService(new PromptAssetRepository(db));

function replyNotFound(err: unknown, reply: FastifyReply): FastifyReply {
  if (err instanceof PromptAssetNotFoundError) {
    return reply.code(404).send({ error: err.message });
  }
  throw err;
}

export async function promptAssetController(app: FastifyInstance): Promise<void> {
  app.get(
    '/',
    { preHandler: requireCapability(CAPABILITIES.TENANT_PROMPTS_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listByTenant(user.tenant_id) };
    },
  );

  app.post<{ Body: Omit<CreatePromptAssetInput, 'tenant_id'> }>(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_PROMPTS_CREATE),
      schema: {
        body: {
          type: 'object',
          required: ['name', 'media_type', 'storage_uri'],
          additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            media_type: { type: 'string', minLength: 1, maxLength: 255 },
            language: { type: 'string', minLength: 1, maxLength: 32 },
            storage_uri: { type: 'string', minLength: 1, maxLength: 2048 },
            checksum: { type: 'string', minLength: 1, maxLength: 255 },
          },
        },
      },
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

  app.get<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_PROMPTS_VIEW),
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
      },
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

  app.patch<{ Params: { id: string }; Body: UpdatePromptAssetInput }>(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_PROMPTS_UPDATE),
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            media_type: { type: 'string', minLength: 1, maxLength: 255 },
            language: { anyOf: [{ type: 'string', minLength: 1, maxLength: 32 }, { type: 'null' }] },
            storage_uri: { anyOf: [{ type: 'string', minLength: 1, maxLength: 2048 }, { type: 'null' }] },
            checksum: { anyOf: [{ type: 'string', minLength: 1, maxLength: 255 }, { type: 'null' }] },
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
        return replyNotFound(err, reply);
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    '/:id/deactivate',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_PROMPTS_DEACTIVATE),
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
      },
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
}
