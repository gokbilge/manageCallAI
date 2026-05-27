import type { FastifyInstance, FastifyReply } from 'fastify';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { authenticate } from '../auth/authenticate.js';
import { SipTrunkRepository } from './sip-trunk.repository.js';
import { SipTrunkNotFoundError, SipTrunkService } from './sip-trunk.service.js';
import type { CreateSipTrunkBody, UpdateSipTrunkInput } from './sip-trunk.types.js';

const DIRECTIONS = ['inbound', 'outbound', 'bidirectional'] as const;
const TRANSPORTS = ['udp', 'tcp', 'tls'] as const;

const service = new SipTrunkService(new SipTrunkRepository(db));

function replyNotFound(err: unknown, reply: FastifyReply): FastifyReply {
  if (err instanceof SipTrunkNotFoundError) {
    return reply.code(404).send({ error: err.message });
  }
  throw err;
}

export async function sipTrunkController(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get('/', async (req) => {
    const user = req.user as AuthClaims;
    return { data: await service.listByTenant(user.tenant_id) };
  });

  app.post<{ Body: CreateSipTrunkBody }>(
    '/',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name', 'direction', 'realm', 'proxy', 'auth_username', 'auth_password'],
          additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            direction: { type: 'string', enum: [...DIRECTIONS] },
            realm: { type: 'string', minLength: 1, maxLength: 255 },
            proxy: { type: 'string', minLength: 1, maxLength: 255 },
            port: { type: 'integer', minimum: 1, maximum: 65535 },
            transport: { type: 'string', enum: [...TRANSPORTS] },
            username: { type: 'string', minLength: 1, maxLength: 255 },
            auth_username: { type: 'string', minLength: 1, maxLength: 255 },
            auth_password: { type: 'string', minLength: 8, maxLength: 255 },
          },
        },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      const trunk = await service.create({
        ...req.body,
        tenant_id: user.tenant_id,
      });
      return reply.code(201).send({ data: trunk });
    },
  );

  app.get<{ Params: { id: string } }>(
    '/:id',
    {
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

  app.patch<{ Params: { id: string }; Body: UpdateSipTrunkInput }>(
    '/:id',
    {
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
            status: { type: 'string', enum: ['active', 'inactive'] },
            direction: { type: 'string', enum: [...DIRECTIONS] },
            realm: { type: 'string', minLength: 1, maxLength: 255 },
            proxy: { type: 'string', minLength: 1, maxLength: 255 },
            port: { type: 'integer', minimum: 1, maximum: 65535 },
            transport: { type: 'string', enum: [...TRANSPORTS] },
            username: { anyOf: [{ type: 'string', minLength: 1, maxLength: 255 }, { type: 'null' }] },
            auth_username: { type: 'string', minLength: 1, maxLength: 255 },
            auth_password: { type: 'string', minLength: 8, maxLength: 255 },
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
