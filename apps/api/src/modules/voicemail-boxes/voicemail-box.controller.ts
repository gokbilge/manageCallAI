import type { FastifyInstance, FastifyReply } from 'fastify';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { VoicemailBoxRepository } from './voicemail-box.repository.js';
import {
  VoicemailBoxInputError,
  VoicemailBoxNotFoundError,
  VoicemailBoxService,
} from './voicemail-box.service.js';
import type { CreateVoicemailBoxInput, UpdateVoicemailBoxInput } from './voicemail-box.types.js';
import { sendNotFound, sendInvalidArgument } from '../../errors/index.js';

const service = new VoicemailBoxService(new VoicemailBoxRepository(db));

function replyError(err: unknown, reply: FastifyReply): void {
  if (err instanceof VoicemailBoxNotFoundError) {
    return sendNotFound(reply, err.message);
  }
  if (err instanceof VoicemailBoxInputError) {
    return sendInvalidArgument(reply, err.message);
  }
  throw err;
}

export async function voicemailBoxController(app: FastifyInstance): Promise<void> {
  app.get(
    '/',
    { preHandler: requireCapability(CAPABILITIES.TENANT_VOICEMAIL_BOXES_VIEW) },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listByTenant(user.tenant_id) };
    },
  );

  app.post<{ Body: Omit<CreateVoicemailBoxInput, 'tenant_id'> }>(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_VOICEMAIL_BOXES_CREATE),
      schema: {
        body: {
          type: 'object',
          required: ['name', 'mailbox_number'],
          additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            description: { type: 'string', maxLength: 1000 },
            mailbox_number: { type: 'string', pattern: '^[0-9]{2,12}$' },
            greeting_prompt_id: { anyOf: [{ type: 'string', format: 'uuid' }, { type: 'null' }] },
          },
        },
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const box = await service.create({ ...req.body, tenant_id: user.tenant_id });
        return reply.code(201).send({ data: box });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.get<{ Params: { id: string } }>(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_VOICEMAIL_BOXES_VIEW),
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

  app.patch<{ Params: { id: string }; Body: UpdateVoicemailBoxInput }>(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_VOICEMAIL_BOXES_UPDATE),
      schema: {
        params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 255 },
            description: { anyOf: [{ type: 'string', maxLength: 1000 }, { type: 'null' }] },
            mailbox_number: { type: 'string', pattern: '^[0-9]{2,12}$' },
            greeting_prompt_id: { anyOf: [{ type: 'string', format: 'uuid' }, { type: 'null' }] },
            status: { type: 'string', enum: ['active', 'inactive'] },
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

  app.post<{ Params: { id: string } }>(
    '/:id/deactivate',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_VOICEMAIL_BOXES_DEACTIVATE),
      schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.deactivate(req.params.id, user.tenant_id) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );
}
