import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { CrmIntegrationsRepository } from './crm-integrations.repository.js';
import {
  CrmIntegrationNotFoundError,
  CrmValidationError,
  CrmIntegrationsService,
} from './crm-integrations.service.js';
import { sendNotFound, sendInvalidArgument } from '../../errors/index.js';
import {
  UuidParamsSchema,
  CreateCrmIntegrationBodySchema,
  UpdateCrmIntegrationBodySchema,
  CrmLookupBodySchema,
} from '@managecallai/contracts';

const service = new CrmIntegrationsService(new CrmIntegrationsRepository(db));

function replyError(err: unknown, reply: FastifyReply): void {
  if (err instanceof CrmIntegrationNotFoundError) return sendNotFound(reply, err.message);
  if (err instanceof CrmValidationError) return sendInvalidArgument(reply, err.message);
  throw err;
}

export const crmIntegrationController: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/',
    { preHandler: requireCapability(CAPABILITIES.TENANT_CRM_INTEGRATIONS_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listByTenant(user.tenant_id) };
    },
  );

  app.post(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CRM_INTEGRATIONS_MANAGE),
      schema: { body: CreateCrmIntegrationBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const integration = await service.create({ ...req.body, tenant_id: user.tenant_id });
        return reply.code(201).send({ data: integration });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.get(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CRM_INTEGRATIONS_VIEW),
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
      preHandler: requireCapability(CAPABILITIES.TENANT_CRM_INTEGRATIONS_MANAGE),
      schema: { params: UuidParamsSchema, body: UpdateCrmIntegrationBodySchema },
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
    '/:id/lookup',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CRM_LOOKUP),
      schema: { params: UuidParamsSchema, body: CrmLookupBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const result = await service.performLookup(req.params.id, user.tenant_id, req.body);
        return reply.code(201).send({ data: result });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.get(
    '/:id/lookup-log',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CRM_INTEGRATIONS_VIEW),
      schema: { params: UuidParamsSchema },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listLookupLog(req.params.id, user.tenant_id) };
    },
  );
};
