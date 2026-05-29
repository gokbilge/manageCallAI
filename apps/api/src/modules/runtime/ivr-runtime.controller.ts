import type { FastifyInstance, FastifyReply } from 'fastify';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { authenticateRuntime } from './runtime-auth.js';
import { IvrRuntimeRepository } from './ivr-runtime.repository.js';
import {
  IvrRuntimeFlowNotPublishedError,
  IvrRuntimeResolutionError,
  IvrRuntimeService,
  IvrRuntimeSessionNotFoundError,
  IvrRuntimeSessionStateError,
} from './ivr-runtime.service.js';
import type {
  AdvanceIvrRuntimeSessionInput,
  StartIvrRuntimeSessionInput,
} from './ivr-runtime.types.js';
import { sendNotFound, sendConflict, sendInvalidArgument } from '../../errors/index.js';

const service = new IvrRuntimeService(new IvrRuntimeRepository(db));

function replyRuntimeError(err: unknown, reply: FastifyReply): void {
  if (err instanceof IvrRuntimeSessionNotFoundError || err instanceof IvrRuntimeFlowNotPublishedError) {
    return sendNotFound(reply, err.message);
  }
  if (err instanceof IvrRuntimeSessionStateError) {
    return sendConflict(reply, err.message);
  }
  if (err instanceof IvrRuntimeResolutionError) {
    return sendInvalidArgument(reply, err.message);
  }
  throw err;
}

export async function ivrRuntimeController(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { status?: string } }>(
    '/sessions',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_VIEW),
      schema: {
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['running', 'completed', 'failed'] },
          },
        },
      },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      const status = req.query.status as 'running' | 'completed' | 'failed' | undefined;
      return { data: await service.listSessions(user.tenant_id, status) };
    },
  );

  app.get<{ Params: { sessionId: string } }>(
    '/sessions/:sessionId',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_VIEW),
      schema: {
        params: {
          type: 'object',
          required: ['sessionId'],
          properties: {
            sessionId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.getSessionReplay(req.params.sessionId, user.tenant_id) };
      } catch (err) {
        return replyRuntimeError(err, reply);
      }
    },
  );

  app.post<{ Body: StartIvrRuntimeSessionInput }>(
    '/sessions',
    {
      preHandler: authenticateRuntime,
      schema: {
        body: {
          type: 'object',
          required: ['call_id', 'flow_id'],
          additionalProperties: false,
          properties: {
            call_id: { type: 'string', minLength: 1, maxLength: 255 },
            flow_id: { type: 'string', format: 'uuid' },
            caller_number: { type: 'string', maxLength: 255 },
            destination_number: { type: 'string', maxLength: 255 },
            variables: {
              type: 'object',
              additionalProperties: { type: 'string', maxLength: 255 },
            },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        const result = await service.startSession(req.body);
        return reply.code(201).send({ data: result });
      } catch (err) {
        return replyRuntimeError(err, reply);
      }
    },
  );

  app.post<{ Params: { sessionId: string }; Body: AdvanceIvrRuntimeSessionInput }>(
    '/sessions/:sessionId/advance',
    {
      preHandler: authenticateRuntime,
      schema: {
        params: {
          type: 'object',
          required: ['sessionId'],
          properties: {
            sessionId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['node_id', 'outcome'],
          additionalProperties: false,
          properties: {
            node_id: { type: 'string', minLength: 1, maxLength: 255 },
            outcome: { type: 'string', enum: ['completed', 'digits', 'timeout', 'invalid'] },
            digits: { type: 'string', minLength: 1, maxLength: 64 },
            variables: {
              type: 'object',
              additionalProperties: { type: 'string', maxLength: 255 },
            },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        return { data: await service.advanceSession(req.params.sessionId, req.body) };
      } catch (err) {
        return replyRuntimeError(err, reply);
      }
    },
  );
}
