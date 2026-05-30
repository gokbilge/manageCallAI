import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { db } from '../../db/client.js';
import { config } from '../../config/env.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { requireCapability } from '../auth/require-capability.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { ObservabilityRepository } from './observability.repository.js';
import { ObservabilityService } from './observability.service.js';

const repo = new ObservabilityRepository(db);
const service = new ObservabilityService(repo);

// How often the SSE stream pushes a new snapshot (ms).
const SSE_INTERVAL_MS = 5_000;

// Platform service health check targets derived from env config.
function platformHealthChecks() {
  return [
    { name: 'api', url: config.platformApiHealthUrl },
    { name: 'worker', url: config.platformWorkerHealthUrl },
    { name: 'freeswitch-agent', url: config.platformFreeswitchAgentHealthUrl },
  ];
}

export const observabilityController: FastifyPluginAsyncZod = async (app) => {
  // ── REST snapshot ─────────────────────────────────────────────────────────
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

  // ── SSE stream ────────────────────────────────────────────────────────────
  // Streams StreamEvent objects every SSE_INTERVAL_MS.
  // Authentication: standard Bearer JWT in the Authorization header (use fetch,
  // not the native EventSource, since EventSource cannot send custom headers).
  //
  // StreamEvent format: { status: 'live' | 'degraded', data: snapshot | null, generated_at }
  // Ping format:        : ping\n\n   (sent when a snapshot fetch fails to keep connection alive)
  //
  // Cross-tenant isolation: the tenant_id is read from the verified JWT claims;
  // snapshot queries are always scoped to that tenant_id.
  // No provider secrets, raw switch payloads, or cross-tenant data are included.
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

      reply.hijack();

      const sendEvent = (status: 'live' | 'degraded', data: unknown): void => {
        if (!reply.raw.writable) return;
        const event = { status, data: status === 'live' ? data : null, generated_at: new Date().toISOString() };
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      const ping = (): void => {
        if (!reply.raw.writable) return;
        reply.raw.write(': ping\n\n');
      };

      // Send the initial snapshot immediately so the client has data at connect time.
      try {
        const initial = await service.getSnapshot(claims.tenant_id);
        sendEvent('live', initial);
      } catch {
        ping();
      }

      const intervalId = setInterval(async () => {
        try {
          const snapshot = await service.getSnapshot(claims.tenant_id);
          sendEvent('live', snapshot);
        } catch {
          // Emit a degraded event so the client knows the stream is alive but unhealthy.
          sendEvent('degraded', null);
        }
      }, SSE_INTERVAL_MS);

      req.raw.on('close', () => {
        clearInterval(intervalId);
      });
    },
  );

  // ── Platform health snapshot ───────────────────────────────────────────────
  // Returns aggregate runtime health for platform admins.
  // Requires PLATFORM_RUNTIME_VIEW capability — inaccessible to tenant-only users.
  // No per-tenant or cross-tenant session data is included.
  app.get(
    '/platform-health',
    { preHandler: requireCapability(CAPABILITIES.PLATFORM_RUNTIME_VIEW) },
    async () => {
      const health = await service.getPlatformHealth(platformHealthChecks());
      return { data: health };
    },
  );
};
