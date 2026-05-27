import type { FastifyInstance, FastifyReply } from 'fastify';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { IvrFlowRepository } from './ivr-flow.repository.js';
import {
  FlowVersionNotFoundError,
  FlowVersionStateError,
  IvrFlowNotFoundError,
  IvrFlowService,
  RollbackNotAvailableError,
} from './ivr-flow.service.js';
import { defaultIvrGraph } from './ivr-flow.validation.js';

const service = new IvrFlowService(new IvrFlowRepository(db));

function replyError(err: unknown, reply: FastifyReply): FastifyReply {
  if (err instanceof IvrFlowNotFoundError || err instanceof FlowVersionNotFoundError) {
    return reply.code(404).send({ error: err.message });
  }
  if (err instanceof FlowVersionStateError || err instanceof RollbackNotAvailableError) {
    return reply.code(409).send({ error: err.message });
  }
  throw err;
}

export async function ivrFlowController(app: FastifyInstance): Promise<void> {
  app.get(
    '/',
    { preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listByTenant(user.tenant_id) };
    },
  );

  app.post<{ Body: { name: string; description?: string; graph_json?: Record<string, unknown>; definition?: Record<string, unknown> } }>(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_CREATE),
      schema: {
        body: {
          type: 'object',
          required: ['name'],
          additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string', maxLength: 1000 },
            graph_json: { type: 'object' },
            definition: { type: 'object' },
          },
        },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      const flow = await service.create({
        tenant_id: user.tenant_id,
        name: req.body.name,
        description: req.body.description,
        graph_json: req.body.graph_json ?? req.body.definition ?? defaultIvrGraph(),
        created_by: user.sub,
      });
      return reply.code(201).send({ data: flow });
    },
  );

  app.get<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_VIEW),
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

  app.patch<{ Params: { id: string }; Body: { name?: string; description?: string | null; status?: 'draft' | 'active' | 'inactive' } }>(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_UPDATE),
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            description: { anyOf: [{ type: 'string', maxLength: 1000 }, { type: 'null' }] },
            status: { type: 'string', enum: ['draft', 'active', 'inactive'] },
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

  app.get<{ Params: { id: string } }>(
    '/:id/versions',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_VIEW),
      schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.listVersions(req.params.id, user.tenant_id) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.post<{ Params: { id: string }; Body: { graph_json?: Record<string, unknown>; definition?: Record<string, unknown> } }>(
    '/:id/versions',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_UPDATE),
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            graph_json: { type: 'object' },
            definition: { type: 'object' },
          },
        },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const version = await service.createVersion(req.params.id, user.tenant_id, req.body.graph_json ?? req.body.definition, user.sub);
        return reply.code(201).send({ data: version });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.get<{ Params: { id: string; vid: string } }>(
    '/:id/versions/:vid',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_VIEW),
      schema: {
        params: { type: 'object', required: ['id', 'vid'], properties: { id: { type: 'string' }, vid: { type: 'string' } } },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.getVersion(req.params.id, req.params.vid, user.tenant_id) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.patch<{ Params: { id: string; vid: string }; Body: { graph_json?: Record<string, unknown>; definition?: Record<string, unknown> } }>(
    '/:id/versions/:vid',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_UPDATE),
      schema: {
        params: { type: 'object', required: ['id', 'vid'], properties: { id: { type: 'string' }, vid: { type: 'string' } } },
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            graph_json: { type: 'object' },
            definition: { type: 'object' },
          },
          anyOf: [{ required: ['graph_json'] }, { required: ['definition'] }],
        },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return {
          data: await service.updateVersionDefinition(
            req.params.id,
            req.params.vid,
            user.tenant_id,
            req.body.graph_json ?? req.body.definition ?? defaultIvrGraph(),
          ),
        };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    '/:id/validate',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_VALIDATE),
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const result = await service.validateCurrentDraft(req.params.id, user.tenant_id);
        const statusCode = result.outcome.status === 'passed' ? 200 : 422;
        return reply.code(statusCode).send({ data: result });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.post<{ Params: { id: string; vid: string } }>(
    '/:id/versions/:vid/validate',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_VALIDATE),
      schema: {
        params: { type: 'object', required: ['id', 'vid'], properties: { id: { type: 'string' }, vid: { type: 'string' } } },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const result = await service.validate(req.params.id, req.params.vid, user.tenant_id);
        const statusCode = result.outcome.status === 'passed' ? 200 : 422;
        return reply.code(statusCode).send({ data: result });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.post<{ Params: { id: string; vid: string } }>(
    '/:id/simulate',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_SIMULATE),
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            digits: { type: 'array', items: { type: 'string', minLength: 1, maxLength: 8 } },
            collected_digits: {
              type: 'object',
              additionalProperties: { type: 'string', minLength: 1, maxLength: 32 },
            },
            caller_number: { type: 'string', maxLength: 64 },
            now: { type: 'string', format: 'date-time' },
            force_timeout: { type: 'boolean' },
            force_timeout_nodes: { type: 'array', items: { type: 'string', minLength: 1, maxLength: 255 } },
            force_invalid: { type: 'boolean' },
            force_invalid_nodes: { type: 'array', items: { type: 'string', minLength: 1, maxLength: 255 } },
            variables: {
              type: 'object',
              additionalProperties: { type: 'string', maxLength: 255 },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const result = await service.simulateCurrentDraft(req.params.id, user.tenant_id, req.body ?? {});
        const statusCode = result.outcome.status === 'passed' ? 200 : 422;
        return reply.code(statusCode).send({ data: result });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.post<{ Params: { id: string; vid: string } }>(
    '/:id/versions/:vid/simulate',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_SIMULATE),
      schema: {
        params: { type: 'object', required: ['id', 'vid'], properties: { id: { type: 'string' }, vid: { type: 'string' } } },
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            digits: { type: 'array', items: { type: 'string', minLength: 1, maxLength: 8 } },
            collected_digits: {
              type: 'object',
              additionalProperties: { type: 'string', minLength: 1, maxLength: 32 },
            },
            caller_number: { type: 'string', maxLength: 64 },
            now: { type: 'string', format: 'date-time' },
            force_timeout: { type: 'boolean' },
            force_timeout_nodes: { type: 'array', items: { type: 'string', minLength: 1, maxLength: 255 } },
            force_invalid: { type: 'boolean' },
            force_invalid_nodes: { type: 'array', items: { type: 'string', minLength: 1, maxLength: 255 } },
            variables: {
              type: 'object',
              additionalProperties: { type: 'string', maxLength: 255 },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const result = await service.simulate(req.params.id, req.params.vid, user.tenant_id, req.body ?? {});
        const statusCode = result.outcome.status === 'passed' ? 200 : 422;
        return reply.code(statusCode).send({ data: result });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.post<{ Params: { id: string; vid: string } }>(
    '/:id/versions/:vid/publish',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_PUBLISH),
      schema: {
        params: { type: 'object', required: ['id', 'vid'], properties: { id: { type: 'string' }, vid: { type: 'string' } } },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const result = await service.publish(req.params.id, req.params.vid, user.tenant_id, user.sub, user.role);
        const statusCode = result.status === 'pending_approval' ? 202 : 200;
        return reply.code(statusCode).send({ data: result });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    '/:id/rollback',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_ROLLBACK),
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const result = await service.rollback(req.params.id, user.tenant_id, user.sub, user.role);
        const statusCode = result.status === 'pending_approval' ? 202 : 200;
        return reply.code(statusCode).send({ data: result });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );
}
