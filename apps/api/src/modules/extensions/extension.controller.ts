import type { FastifyInstance, FastifyReply } from 'fastify';
import { db } from '../../db/client.js';
import { authenticate } from '../auth/authenticate.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { ExtensionRepository } from './extension.repository.js';
import { ExtensionNotFoundError, ExtensionService } from './extension.service.js';
import type { CreateExtensionBody, UpdateExtensionInput } from './extension.types.js';

const DESTINATION_TYPES = ['flow', 'extension', 'user', 'queue'] as const;

const service = new ExtensionService(new ExtensionRepository(db));

function replyNotFound(err: unknown, reply: FastifyReply): FastifyReply {
  if (err instanceof ExtensionNotFoundError) {
    return reply.code(404).send({ error: err.message });
  }
  throw err;
}

export async function extensionController(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: Record<string, never> }>(
    '/',
    { preHandler: authenticate },
    async (req) => {
      const user = req.user as AuthClaims;
      const extensions = await service.listByTenant(user.tenant_id);
      return { data: extensions };
    },
  );

  app.post<{ Body: CreateExtensionBody }>(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_CREATE),
      schema: {
        body: {
          type: 'object',
          required: ['extension_number', 'display_name', 'sip_password'],
          additionalProperties: false,
          properties: {
            extension_number: { type: 'string', minLength: 1, maxLength: 20 },
            display_name: { type: 'string', minLength: 1, maxLength: 255 },
            sip_username: { type: 'string', minLength: 1, maxLength: 64 },
            sip_password: { type: 'string', minLength: 8, maxLength: 128 },
            default_destination_type: { type: 'string', enum: [...DESTINATION_TYPES] },
            default_destination_id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      const ext = await service.create({
        ...req.body,
        tenant_id: user.tenant_id,
      });
      return reply.code(201).send({ data: ext });
    },
  );

  app.get<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: authenticate,
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

  app.patch<{ Params: { id: string }; Body: UpdateExtensionInput }>(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_UPDATE),
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
            extension_number: { type: 'string', minLength: 1, maxLength: 20 },
            display_name: { type: 'string', minLength: 1, maxLength: 255 },
            status: { type: 'string', enum: ['active', 'inactive'] },
            sip_username: { type: 'string', minLength: 1, maxLength: 64 },
            sip_password: { type: 'string', minLength: 8, maxLength: 128 },
            default_destination_type: {
              anyOf: [{ type: 'string', enum: [...DESTINATION_TYPES] }, { type: 'null' }],
            },
            default_destination_id: { anyOf: [{ type: 'string', format: 'uuid' }, { type: 'null' }] },
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
      preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_DEACTIVATE),
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
