import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { CreatePhoneNumberBodySchema, UpdatePhoneNumberBodySchema, UuidParamsSchema } from '@managecallai/contracts';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { PhoneNumberRepository } from './phone-number.repository.js';
import { PhoneNumberNotFoundError, PhoneNumberService } from './phone-number.service.js';
import { sendNotFound, sendEntitlementLimitExceeded } from '../../errors/index.js';
import { entitlementSvc, EntitlementLimitExceededError } from '../entitlement/index.js';

const service = new PhoneNumberService(new PhoneNumberRepository(db));

function replyNotFound(err: unknown, reply: FastifyReply): void {
  if (err instanceof PhoneNumberNotFoundError) {
    return sendNotFound(reply, err.message);
  }
  throw err;
}

export const phoneNumberController: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/',
    { preHandler: requireCapability(CAPABILITIES.TENANT_PHONE_NUMBERS_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listByTenant(user.tenant_id) };
    },
  );

  app.post(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_PHONE_NUMBERS_CREATE),
      schema: { body: CreatePhoneNumberBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        await entitlementSvc.assertWithinLimit(user.tenant_id, 'did.max_count');
      } catch (err) {
        if (err instanceof EntitlementLimitExceededError) return sendEntitlementLimitExceeded(reply, err);
        throw err;
      }
      const number = await service.create({ ...req.body, tenant_id: user.tenant_id });
      return reply.code(201).send({ data: number });
    },
  );

  app.get(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_PHONE_NUMBERS_VIEW),
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
      preHandler: requireCapability(CAPABILITIES.TENANT_PHONE_NUMBERS_UPDATE),
      schema: {
        params: UuidParamsSchema,
        body: UpdatePhoneNumberBodySchema,
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
      preHandler: requireCapability(CAPABILITIES.TENANT_PHONE_NUMBERS_DEACTIVATE),
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
