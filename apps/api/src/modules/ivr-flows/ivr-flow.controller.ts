import type { FastifyInstance, FastifyReply } from 'fastify';
import { db } from '../../db/client.js';
import { authenticate } from '../auth/authenticate.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { IvrFlowRepository } from './ivr-flow.repository.js';
import {
  FlowVersionNotFoundError,
  FlowVersionStateError,
  IvrFlowNotFoundError,
  IvrFlowService,
  RollbackNotAvailableError,
} from './ivr-flow.service.js';

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
  app.addHook('preHandler', authenticate);

  // List flows
  app.get('/', async (req) => {
    const user = req.user as AuthClaims;
    return { data: await service.listByTenant(user.tenant_id) };
  });

  // Create flow
  app.post<{ Body: { name: string; description?: string; definition: Record<string, unknown> } }>(
    '/',
    {
      schema: {
        body: {
          type: 'object',
          required: ['name', 'definition'],
          additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string', maxLength: 1000 },
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
        definition: req.body.definition,
        created_by: user.sub,
      });
      return reply.code(201).send({ data: flow });
    },
  );

  // Get flow with versions
  app.get<{ Params: { id: string } }>(
    '/:id',
    { schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } } },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.getById(req.params.id, user.tenant_id) };
      } catch (err) { return replyError(err, reply); }
    },
  );

  // Update flow metadata
  app.patch<{ Params: { id: string }; Body: { name?: string; description?: string | null } }>(
    '/:id',
    {
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            description: { anyOf: [{ type: 'string', maxLength: 1000 }, { type: 'null' }] },
          },
        },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.update(req.params.id, user.tenant_id, req.body) };
      } catch (err) { return replyError(err, reply); }
    },
  );

  // Create new draft version
  app.post<{ Params: { id: string }; Body: { definition: Record<string, unknown> } }>(
    '/:id/versions',
    {
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          required: ['definition'],
          additionalProperties: false,
          properties: { definition: { type: 'object' } },
        },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const version = await service.createVersion(req.params.id, user.tenant_id, req.body.definition, user.sub);
        return reply.code(201).send({ data: version });
      } catch (err) { return replyError(err, reply); }
    },
  );

  // Update draft version definition
  app.patch<{ Params: { id: string; vid: string }; Body: { definition: Record<string, unknown> } }>(
    '/:id/versions/:vid',
    {
      schema: {
        params: { type: 'object', required: ['id', 'vid'], properties: { id: { type: 'string' }, vid: { type: 'string' } } },
        body: {
          type: 'object',
          required: ['definition'],
          additionalProperties: false,
          properties: { definition: { type: 'object' } },
        },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.updateVersionDefinition(req.params.id, req.params.vid, user.tenant_id, req.body.definition) };
      } catch (err) { return replyError(err, reply); }
    },
  );

  // Validate a version
  app.post<{ Params: { id: string; vid: string } }>(
    '/:id/versions/:vid/validate',
    {
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
      } catch (err) { return replyError(err, reply); }
    },
  );

  // Publish a validated version
  app.post<{ Params: { id: string; vid: string } }>(
    '/:id/versions/:vid/publish',
    {
      schema: {
        params: { type: 'object', required: ['id', 'vid'], properties: { id: { type: 'string' }, vid: { type: 'string' } } },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const flow = await service.publish(req.params.id, req.params.vid, user.tenant_id, user.sub);
        return { data: flow };
      } catch (err) { return replyError(err, reply); }
    },
  );

  // Rollback to previous published version
  app.post<{ Params: { id: string } }>(
    '/:id/rollback',
    {
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const flow = await service.rollback(req.params.id, user.tenant_id, user.sub);
        return { data: flow };
      } catch (err) { return replyError(err, reply); }
    },
  );
}
