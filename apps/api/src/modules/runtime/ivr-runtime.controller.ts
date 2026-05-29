import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  StartIvrRuntimeSessionBodySchema,
  AdvanceIvrRuntimeSessionBodySchema,
} from '@managecallai/contracts';
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
import { sendNotFound, sendFailedPrecondition, sendInvalidArgument } from '../../errors/index.js';

const service = new IvrRuntimeService(new IvrRuntimeRepository(db));

function replyRuntimeError(err: unknown, reply: FastifyReply): void {
  if (err instanceof IvrRuntimeSessionNotFoundError || err instanceof IvrRuntimeFlowNotPublishedError) {
    return sendNotFound(reply, err.message);
  }
  if (err instanceof IvrRuntimeSessionStateError) {
    return sendFailedPrecondition(reply, err.message);
  }
  if (err instanceof IvrRuntimeResolutionError) {
    return sendInvalidArgument(reply, err.message);
  }
  throw err;
}

export const ivrRuntimeController: FastifyPluginAsyncZod = async (app) => {
  app.get(
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
      const status = (req.query as { status?: string }).status as 'running' | 'completed' | 'failed' | undefined;
      return { data: await service.listSessions(user.tenant_id, status) };
    },
  );

  app.get(
    '/sessions/:sessionId',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_IVR_FLOWS_VIEW),
      schema: {
        params: z.object({ sessionId: z.string().uuid() }),
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

  app.post(
    '/sessions',
    {
      preHandler: authenticateRuntime,
      schema: {
        body: StartIvrRuntimeSessionBodySchema,
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

  app.post(
    '/sessions/:sessionId/advance',
    {
      preHandler: authenticateRuntime,
      schema: {
        params: z.object({ sessionId: z.string().uuid() }),
        body: AdvanceIvrRuntimeSessionBodySchema,
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
};
