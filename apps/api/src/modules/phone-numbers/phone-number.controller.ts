import type { FastifyInstance, FastifyReply } from 'fastify';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { PhoneNumberRepository } from './phone-number.repository.js';
import { PhoneNumberNotFoundError, PhoneNumberService } from './phone-number.service.js';
import type { CreatePhoneNumberBody, UpdatePhoneNumberInput } from './phone-number.types.js';
import { sendNotFound } from '../../errors/index.js';

const TARGET_TYPES = ['inbound_route', 'flow', 'extension'] as const;

const service = new PhoneNumberService(new PhoneNumberRepository(db));

function replyNotFound(err: unknown, reply: FastifyReply): void {
  if (err instanceof PhoneNumberNotFoundError) {
    return sendNotFound(reply, err.message);
  }
  throw err;
}

export async function phoneNumberController(app: FastifyInstance): Promise<void> {
  app.get(
    '/',
    { preHandler: requireCapability(CAPABILITIES.TENANT_PHONE_NUMBERS_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listByTenant(user.tenant_id) };
    },
  );

  app.post<{ Body: CreatePhoneNumberBody }>(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_PHONE_NUMBERS_CREATE),
      schema: {
        body: {
          type: 'object',
          required: ['e164_number'],
          additionalProperties: false,
          properties: {
            e164_number:   { type: 'string', minLength: 2, maxLength: 32 },
            display_label: { type: 'string', minLength: 1, maxLength: 255 },
            trunk_id:      { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      const number = await service.create({ ...req.body, tenant_id: user.tenant_id });
      return reply.code(201).send({ data: number });
    },
  );

  app.get<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_PHONE_NUMBERS_VIEW),
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

  app.patch<{ Params: { id: string }; Body: UpdatePhoneNumberInput }>(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_PHONE_NUMBERS_UPDATE),
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
            display_label:        { anyOf: [{ type: 'string', minLength: 1, maxLength: 255 }, { type: 'null' }] },
            trunk_id:             { anyOf: [{ type: 'string', format: 'uuid' }, { type: 'null' }] },
            assigned_target_type: { anyOf: [{ type: 'string', enum: [...TARGET_TYPES] }, { type: 'null' }] },
            assigned_target_id:   { anyOf: [{ type: 'string', format: 'uuid' }, { type: 'null' }] },
            status:               { type: 'string', enum: ['active', 'inactive'] },
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
      preHandler: requireCapability(CAPABILITIES.TENANT_PHONE_NUMBERS_DEACTIVATE),
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
