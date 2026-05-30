import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { authenticateRuntime } from '../runtime/runtime-auth.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { sendNotFound } from '../../errors/index.js';

interface VoicemailMessage {
  id: string;
  tenant_id: string;
  voicemail_box_id: string;
  call_id: string;
  storage_path: string;
  duration_secs: number | null;
  size_bytes: number | null;
  read_at: Date | null;
  deleted_at: Date | null;
  recorded_at: Date;
  created_at: Date;
}

const UuidParams = z.object({ id: z.string().uuid() });
const BoxUuidParams = z.object({ boxId: z.string().uuid() });

export const voicemailMessageController: FastifyPluginAsyncZod = async (app) => {
  // Runtime ingest — called by FreeSWITCH adapter after voicemail recording completes.
  app.post(
    '/:boxId/messages',
    {
      preHandler: authenticateRuntime,
      schema: {
        params: BoxUuidParams,
        body: z.object({
          tenant_id: z.string().uuid(),
          call_id: z.string().min(1),
          storage_path: z.string().min(1),
          duration_secs: z.number().int().optional(),
          size_bytes: z.number().int().optional(),
        }),
      },
    },
    async (req, reply) => {
      const r = await db.query<VoicemailMessage>(
        `INSERT INTO voicemail_messages
           (tenant_id, voicemail_box_id, call_id, storage_path, duration_secs, size_bytes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, tenant_id, voicemail_box_id, call_id, storage_path,
                   duration_secs, size_bytes, read_at, deleted_at, recorded_at, created_at`,
        [
          req.body.tenant_id,
          req.params.boxId,
          req.body.call_id,
          req.body.storage_path,
          req.body.duration_secs ?? null,
          req.body.size_bytes ?? null,
        ],
      );
      return reply.code(201).send({ data: r.rows[0] });
    },
  );

  // List messages in a mailbox.
  app.get(
    '/:boxId/messages',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_VOICEMAIL_BOXES_VIEW),
      schema: {
        params: BoxUuidParams,
        querystring: z.object({
          unread_only: z.enum(['true', 'false']).default('false'),
          limit: z.coerce.number().int().min(1).max(200).default(50),
        }),
      },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      const unreadOnly = req.query.unread_only === 'true';
      const r = await db.query<VoicemailMessage>(
        `SELECT id, tenant_id, voicemail_box_id, call_id, storage_path,
                duration_secs, size_bytes, read_at, deleted_at, recorded_at, created_at
         FROM voicemail_messages
         WHERE tenant_id = $1
           AND voicemail_box_id = $2
           AND deleted_at IS NULL
           ${unreadOnly ? 'AND read_at IS NULL' : ''}
         ORDER BY recorded_at DESC
         LIMIT $3`,
        [user.tenant_id, req.params.boxId, req.query.limit],
      );
      return { data: r.rows };
    },
  );

  // Mark message as read.
  app.post(
    '/messages/:id/read',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_VOICEMAIL_BOXES_VIEW),
      schema: { params: UuidParams },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      const r = await db.query<VoicemailMessage>(
        `UPDATE voicemail_messages
         SET read_at = COALESCE(read_at, NOW())
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
         RETURNING id, tenant_id, voicemail_box_id, call_id, storage_path,
                   duration_secs, size_bytes, read_at, deleted_at, recorded_at, created_at`,
        [req.params.id, user.tenant_id],
      );
      if (!r.rows[0]) return sendNotFound(reply, `Voicemail message not found: ${req.params.id}`);
      return { data: r.rows[0] };
    },
  );

  // Soft-delete a message.
  app.delete(
    '/messages/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_VOICEMAIL_BOXES_UPDATE),
      schema: { params: UuidParams },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      const r = await db.query<{ id: string }>(
        `UPDATE voicemail_messages SET deleted_at = NOW()
         WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
         RETURNING id`,
        [req.params.id, user.tenant_id],
      );
      if (!r.rows[0]) return sendNotFound(reply, `Voicemail message not found: ${req.params.id}`);
      return reply.code(204).send();
    },
  );
};
