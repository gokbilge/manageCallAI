import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { requireCapability } from '../auth/require-capability.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { ObservabilityRepository } from './observability.repository.js';
import { ObservabilityService } from './observability.service.js';

const service = new ObservabilityService(new ObservabilityRepository(db));

// How often the SSE stream pushes a new snapshot (ms).
const SSE_INTERVAL_MS = 5_000;

export const observabilityController: FastifyPluginAsyncZod = async (app) => {
  // ── REST snapshot ────────────────────────────────────────────────────────────
  // Returns the current live snapshot for the authenticated tenant.
  // Polled by the React UI every 5 s. Also used as the SSE fallback.
  app.get(
    '/snapshot',
    { preHandler: requireCapability(CAPABILITIES.TENANT_DASHBOARD_VIEW) },
    async (req) => {
      const claims = req.user as AuthClaims;
      const snapshot = await service.getSnapshot(claims.tenant_id);
      return { data: snapshot };
    },
  );

  // ── SSE stream ───────────────────────────────────────────────────────────────
  // Streams snapshot events every SSE_INTERVAL_MS.
  // Authentication: standard Bearer JWT in the Authorization header (use fetch,
  // not the native EventSource, since EventSource cannot send custom headers).
  //
  // Event format:  data: <JSON snapshot>\n\n
  // Ping format:   : ping\n\n   (sent every interval to keep connection alive)
  app.get(
    '/stream',
    { preHandler: requireCapability(CAPABILITIES.TENANT_DASHBOARD_VIEW) },
    async (req, reply) => {
      const claims = req.user as AuthClaims;

      reply.raw.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.setHeader('X-Accel-Buffering', 'no');
      reply.raw.flushHeaders();

      // Hijack the response so Fastify doesn't try to serialize it.
      reply.hijack();

      const send = (snapshot: unknown): void => {
        if (!reply.raw.writable) return;
        reply.raw.write(`data: ${JSON.stringify(snapshot)}\n\n`);
      };

      const ping = (): void => {
        if (!reply.raw.writable) return;
        reply.raw.write(': ping\n\n');
      };

      // Send the initial snapshot immediately so the client has data at connect time.
      try {
        const initial = await service.getSnapshot(claims.tenant_id);
        send(initial);
      } catch {
        ping();
      }

      const intervalId = setInterval(async () => {
        try {
          const snapshot = await service.getSnapshot(claims.tenant_id);
          send(snapshot);
        } catch {
          ping();
        }
      }, SSE_INTERVAL_MS);

      req.raw.on('close', () => {
        clearInterval(intervalId);
      });
    },
  );
};
