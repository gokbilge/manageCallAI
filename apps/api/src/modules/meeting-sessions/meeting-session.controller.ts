import type { FastifyInstance, FastifyReply } from 'fastify';
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
import type { CreateMeetingSessionInput, UpdateMeetingSessionInput } from './meeting-session.types.js';

const service = new MeetingSessionService(new MeetingSessionRepository(db));

function replyError(err: unknown, reply: FastifyReply): FastifyReply {
  if (err instanceof MeetingSessionNotFoundError) {
    return reply.code(404).send({ error: err.message });
  }
  if (err instanceof MeetingChannelAccountInvalidError) {
    return reply.code(422).send({ error: err.message });
  }
  throw err;
}

const SESSION_STATUSES = ['scheduled', 'active', 'completed', 'failed'] as const;

export async function meetingSessionController(app: FastifyInstance): Promise<void> {
  app.post<{ Body: Omit<CreateMeetingSessionInput, 'tenant_id'> }>(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_MEETING_SESSIONS_MANAGE),
      schema: {
        body: {
          type: 'object',
          required: ['channel_account_id'],
          additionalProperties: false,
          properties: {
            channel_account_id: { type: 'string' },
            meeting_code: { type: 'string', maxLength: 255 },
            meeting_url: { type: 'string', maxLength: 2048 },
            provider_metadata: { type: 'object', additionalProperties: true },
          },
        },
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

  app.get<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_MEETING_SESSIONS_VIEW),
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

  app.patch<{ Params: { id: string }; Body: UpdateMeetingSessionInput }>(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_MEETING_SESSIONS_MANAGE),
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          additionalProperties: false,
          minProperties: 1,
          properties: {
            status: { type: 'string', enum: [...SESSION_STATUSES] },
            meeting_url: { type: 'string', maxLength: 2048 },
            participant_count: { type: 'integer', minimum: 0 },
            recording_reference: { type: 'string', maxLength: 2048 },
            transcript_reference: { type: 'string', maxLength: 2048 },
            provider_metadata: { type: 'object', additionalProperties: true },
            started_at: { type: 'string', format: 'date-time' },
            ended_at: { type: 'string', format: 'date-time' },
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
}
