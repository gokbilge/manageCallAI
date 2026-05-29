import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
  CreateMeetingSessionBodySchema,
  UpdateMeetingSessionBodySchema,
  UuidParamsSchema,
} from '@managecallai/contracts';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { MeetingSessionRepository } from './meeting-session.repository.js';
import {
  MeetingChannelAccountInvalidError,
  MeetingSessionNotFoundError,
  MeetingSessionService,
} from './meeting-session.service.js';
import { sendNotFound, sendInvalidArgument } from '../../errors/index.js';

const service = new MeetingSessionService(new MeetingSessionRepository(db));

function replyError(err: unknown, reply: FastifyReply): void {
  if (err instanceof MeetingSessionNotFoundError) {
    return sendNotFound(reply, err.message);
  }
  if (err instanceof MeetingChannelAccountInvalidError) {
    return sendInvalidArgument(reply, err.message);
  }
  throw err;
}

export const meetingSessionController: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_MEETING_SESSIONS_MANAGE),
      schema: {
        body: CreateMeetingSessionBodySchema,
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const session = await service.create({ tenant_id: user.tenant_id, ...req.body });
        return reply.code(201).send({ data: session });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.get(
    '/',
    { preHandler: requireCapability(CAPABILITIES.TENANT_MEETING_SESSIONS_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listByTenant(user.tenant_id) };
    },
  );

  app.get(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_MEETING_SESSIONS_VIEW),
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
      preHandler: requireCapability(CAPABILITIES.TENANT_MEETING_SESSIONS_MANAGE),
      schema: {
        params: UuidParamsSchema,
        body: UpdateMeetingSessionBodySchema,
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
};
