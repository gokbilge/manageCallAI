import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { authenticateRuntime } from '../runtime/runtime-auth.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import type { AuthClaims } from '../auth/auth-claims.js';

interface ExtensionEvent {
  id: string;
  tenant_id: string;
  extension_id: string | null;
  extension_number: string;
  event_type: string;
  contact_domain: string | null;
  user_agent: string | null;
  source_ip: string | null;
  freeswitch_event_id: string | null;
  created_at: Date;
}

const IngestExtensionEventBodySchema = z.object({
  tenant_id: z.string().uuid(),
  extension_number: z.string().min(1),
  event_type: z.enum(['registered', 'expired', 'unregistered', 'auth_failed']),
  contact_domain: z.string().optional(),
  user_agent: z.string().optional(),
  source_ip: z.string().optional(),
  freeswitch_event_id: z.string().optional(),
});

export const extensionEventController: FastifyPluginAsyncZod = async (app) => {
  // Runtime-token ingestion endpoint — called by the FreeSWITCH Go adapter.
  app.post(
    '/extension-events',
    {
      preHandler: authenticateRuntime,
      schema: { body: IngestExtensionEventBodySchema },
    },
    async (req, reply) => {
      const body = req.body;

      // Resolve extension_id from the extension_number within the tenant.
      const extRow = await db.query<{ id: string }>(
        `SELECT id FROM extensions WHERE tenant_id = $1 AND extension_number = $2 AND status = 'active'`,
        [body.tenant_id, body.extension_number],
      );
      const extensionId = extRow.rows[0]?.id ?? null;

      const r = await db.query<ExtensionEvent>(
        `INSERT INTO extension_event_log
           (tenant_id, extension_id, extension_number, event_type, contact_domain,
            user_agent, source_ip, freeswitch_event_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (tenant_id, freeswitch_event_id) WHERE freeswitch_event_id IS NOT NULL DO NOTHING
         RETURNING id, tenant_id, extension_id, extension_number, event_type, contact_domain,
                   user_agent, source_ip, freeswitch_event_id, created_at`,
        [
          body.tenant_id,
          extensionId,
          body.extension_number,
          body.event_type,
          body.contact_domain ?? null,
          body.user_agent ?? null,
          body.source_ip ?? null,
          body.freeswitch_event_id ?? null,
        ],
      );

      if (r.rows.length === 0) {
        // Idempotent replay — already ingested.
        return reply.code(200).send({ data: null, replayed: true });
      }

      // Mirror registration events to extension_registrations for the live-state HUD.
      if (body.event_type === 'registered') {
        await db.query(
          `INSERT INTO extension_registrations
             (tenant_id, extension_id, extension_number, status, contact_domain, user_agent, registered_at, last_seen_at)
           VALUES ($1, $2, $3, 'registered', $4, $5, NOW(), NOW())
           ON CONFLICT (tenant_id, extension_number) DO UPDATE
             SET status = 'registered',
                 extension_id = EXCLUDED.extension_id,
                 contact_domain = EXCLUDED.contact_domain,
                 user_agent = EXCLUDED.user_agent,
                 registered_at = NOW(),
                 last_seen_at = NOW(),
                 updated_at = NOW()`,
          [body.tenant_id, extensionId, body.extension_number, body.contact_domain ?? null, body.user_agent ?? null],
        ).catch(() => undefined); // extension_registrations may not exist yet if observability slice not applied
      } else if (body.event_type === 'expired' || body.event_type === 'unregistered') {
        await db.query(
          `UPDATE extension_registrations
           SET status = $3, last_seen_at = NOW(), updated_at = NOW()
           WHERE tenant_id = $1 AND extension_number = $2`,
          [body.tenant_id, body.extension_number, body.event_type === 'expired' ? 'expired' : 'unregistered'],
        ).catch(() => undefined);
      }

      return reply.code(201).send({ data: r.rows[0] });
    },
  );

  // Query endpoint — for operators viewing registration history.
  app.get(
    '/:extensionNumber/events',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_EXTENSIONS_VIEW),
      schema: {
        params: z.object({ extensionNumber: z.string() }),
        querystring: z.object({
          limit: z.coerce.number().int().min(1).max(200).default(50),
        }),
      },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      const r = await db.query<ExtensionEvent>(
        `SELECT id, tenant_id, extension_id, extension_number, event_type, contact_domain,
                user_agent, source_ip, created_at
         FROM extension_event_log
         WHERE tenant_id = $1 AND extension_number = $2
         ORDER BY created_at DESC LIMIT $3`,
        [user.tenant_id, req.params.extensionNumber, req.query.limit],
      );
      return { data: r.rows };
    },
  );
};
