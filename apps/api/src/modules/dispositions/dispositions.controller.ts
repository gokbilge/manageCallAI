import { z } from 'zod';
import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { fireAuditEvent } from '../audit/fire-audit.js';
import { sendNotFound, sendInvalidArgument } from '../../errors/index.js';
import { DispositionsRepository } from './dispositions.repository.js';
import {
  DispositionsService,
  DispositionCodeNotFoundError,
  DispositionValidationError,
  CallNoteNotFoundError,
} from './dispositions.service.js';
import {
  CreateDispositionCodeBodySchema,
  UpdateDispositionCodeBodySchema,
  RecordDispositionBodySchema,
  CreateCallNoteBodySchema,
  UpdateCallNoteBodySchema,
} from '@managecallai/contracts';

const UuidParamSchema = z.object({ id: z.string().uuid() });
const CallIdParamSchema = z.object({ callId: z.string().min(1) });
const NoteParamSchema = z.object({ callId: z.string().min(1), noteId: z.string().uuid() });

const service = new DispositionsService(new DispositionsRepository(db));

function replyError(err: unknown, reply: FastifyReply): void {
  if (err instanceof DispositionCodeNotFoundError || err instanceof CallNoteNotFoundError) {
    return sendNotFound(reply, (err as Error).message);
  }
  if (err instanceof DispositionValidationError) {
    return sendInvalidArgument(reply, (err as Error).message);
  }
  throw err;
}

// ── Disposition code catalog ──────────────────────────────────────────────────

export const dispositionCodeController: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_DISPOSITIONS_VIEW),
      schema: { querystring: z.object({ queue_id: z.string().uuid().optional() }) },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listCodes(user.tenant_id, req.query.queue_id) };
    },
  );

  app.post(
    '/',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_DISPOSITIONS_MANAGE),
      schema: { body: CreateDispositionCodeBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const code = await service.createCode({ ...req.body, tenant_id: user.tenant_id });
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role ?? null,
          action: 'dispositions.code.created',
          resource_type: 'disposition_code',
          resource_id: code.id,
          metadata: { code: code.code },
        });
        return reply.code(201).send({ data: code });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.get(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_DISPOSITIONS_VIEW),
      schema: { params: UuidParamSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.getCodeById(req.params.id, user.tenant_id) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.patch(
    '/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_DISPOSITIONS_MANAGE),
      schema: { params: UuidParamSchema, body: UpdateDispositionCodeBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const code = await service.updateCode(req.params.id, user.tenant_id, req.body);
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role ?? null,
          action: 'dispositions.code.updated',
          resource_type: 'disposition_code',
          resource_id: code.id,
          metadata: {},
        });
        return { data: code };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );
};

// ── Per-call disposition capture ──────────────────────────────────────────────

export const callDispositionController: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/:callId/disposition',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_DISPOSITIONS_VIEW),
      schema: { params: CallIdParamSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      const result = await service.getDispositionByCallId(req.params.callId, user.tenant_id);
      if (!result) return sendNotFound(reply, `No disposition for call ${req.params.callId}`);
      return { data: result };
    },
  );

  app.put(
    '/:callId/disposition',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_DISPOSITIONS_MANAGE),
      schema: { params: CallIdParamSchema, body: RecordDispositionBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const disp = await service.recordDisposition(
          user.tenant_id,
          { call_id: req.params.callId, ...req.body },
          user.sub,
        );
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role ?? null,
          action: 'dispositions.call.recorded',
          resource_type: 'call_disposition',
          resource_id: disp.id,
          metadata: { call_id: req.params.callId, code_id: req.body.disposition_code_id },
        });
        return { data: disp };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  // ── Call notes ───────────────────────────────────────────────────────────

  app.get(
    '/:callId/notes',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CALL_NOTES_VIEW),
      schema: { params: CallIdParamSchema },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listNotesByCall(req.params.callId, user.tenant_id) };
    },
  );

  app.post(
    '/:callId/notes',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CALL_NOTES_MANAGE),
      schema: { params: CallIdParamSchema, body: CreateCallNoteBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const note = await service.createNote(user.tenant_id, user.sub, {
          call_id: req.params.callId,
          content: req.body.content,
        });
        return reply.code(201).send({ data: note });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.patch(
    '/:callId/notes/:noteId',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CALL_NOTES_MANAGE),
      schema: { params: NoteParamSchema, body: UpdateCallNoteBodySchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.updateNote(req.params.noteId, user.tenant_id, user.sub, req.body) };
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.delete(
    '/:callId/notes/:noteId',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CALL_NOTES_MANAGE),
      schema: { params: NoteParamSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        await service.deleteNote(req.params.noteId, user.tenant_id, user.sub);
        return reply.code(204).send();
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );
};
