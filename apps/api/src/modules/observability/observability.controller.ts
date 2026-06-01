import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { UuidParamsSchema } from '@managecallai/contracts';
import { db } from '../../db/client.js';
import { config } from '../../config/env.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { requireCapability } from '../auth/require-capability.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { sendNotFound } from '../../errors/index.js';
import { fireAuditEvent } from '../audit/fire-audit.js';
import { ObservabilityRepository } from './observability.repository.js';
import { AlertNotFoundError, AlertRuleNotFoundError, ObservabilityService } from './observability.service.js';

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

  // ── SLICE-48: Security alert rules ────────────────────────────────────────

  const ALERT_TYPES = [
    'failed_sip_registration',
    'outbound_call_burst',
    'unknown_destination_call',
    'runtime_auth_failure',
    'webhook_delivery_backlog',
    'recording_analysis_backlog',
  ] as const;

  app.get(
    '/security/alert-rules',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_SECURITY_ALERTS_VIEW),
      schema: {
        querystring: z.object({
          alert_type: z.enum(ALERT_TYPES).optional(),
          status: z.enum(['active', 'inactive', 'archived']).optional(),
        }),
      },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listAlertRules(user.tenant_id, req.query) };
    },
  );

  app.post(
    '/security/alert-rules',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_SECURITY_ALERTS_MANAGE),
      schema: {
        body: z.object({
          name: z.string().min(1).max(255),
          description: z.string().max(1000).nullable().optional(),
          alert_type: z.enum(ALERT_TYPES),
          conditions: z.record(z.unknown()),
          severity: z.enum(['info', 'warning', 'critical']).optional(),
          status: z.enum(['active', 'inactive']).optional(),
        }),
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      const rule = await service.createAlertRule(user.tenant_id, user.sub, req.body);
      fireAuditEvent({
        tenant_id: user.tenant_id,
        actor_id: user.sub,
        actor_role: user.role,
        action: 'security_alert_rule.created',
        resource_type: 'security_alert_rule',
        resource_id: rule.id,
      });
      return reply.code(201).send({ data: rule });
    },
  );

  app.patch(
    '/security/alert-rules/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_SECURITY_ALERTS_MANAGE),
      schema: {
        params: UuidParamsSchema,
        body: z.object({
          name: z.string().min(1).max(255).optional(),
          description: z.string().max(1000).nullable().optional(),
          conditions: z.record(z.unknown()).optional(),
          severity: z.enum(['info', 'warning', 'critical']).optional(),
          status: z.enum(['active', 'inactive', 'archived']).optional(),
        }),
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const rule = await service.updateAlertRule(req.params.id, user.tenant_id, req.body);
        return { data: rule };
      } catch (err) {
        if (err instanceof AlertRuleNotFoundError) return sendNotFound(reply, err.message);
        throw err;
      }
    },
  );

  app.delete(
    '/security/alert-rules/:id',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_SECURITY_ALERTS_MANAGE),
      schema: { params: UuidParamsSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        await service.deleteAlertRule(req.params.id, user.tenant_id);
        return reply.code(204).send();
      } catch (err) {
        if (err instanceof AlertRuleNotFoundError) return sendNotFound(reply, err.message);
        throw err;
      }
    },
  );

  // ── SLICE-48: Alert instances ─────────────────────────────────────────────

  app.get(
    '/security/alerts',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_SECURITY_ALERTS_VIEW),
      schema: {
        querystring: z.object({
          status: z.enum(['new', 'acknowledged', 'resolved', 'dismissed']).optional(),
          severity: z.enum(['info', 'warning', 'critical']).optional(),
          since: z.string().datetime().optional(),
          limit: z.string().transform((v) => parseInt(v, 10)).pipe(z.number().int().positive().max(500)).optional(),
        }),
      },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listAlerts(user.tenant_id, req.query) };
    },
  );

  app.post(
    '/security/alerts/evaluate',
    { preHandler: requireCapability(CAPABILITIES.TENANT_SECURITY_ALERTS_MANAGE) },
    async (req) => {
      const user = req.user as AuthClaims;
      const fired = await service.evaluateAllRules(user.tenant_id);
      return { data: fired, fired_count: fired.length };
    },
  );

  app.post(
    '/security/alerts/:id/acknowledge',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_SECURITY_ALERTS_VIEW),
      schema: { params: UuidParamsSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const alert = await service.acknowledgeAlert(req.params.id, user.tenant_id, user.sub);
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role,
          action: 'security_alert.acknowledged',
          resource_type: 'security_alert',
          resource_id: alert.id,
        });
        return { data: alert };
      } catch (err) {
        if (err instanceof AlertNotFoundError) return sendNotFound(reply, err.message);
        throw err;
      }
    },
  );

  app.post(
    '/security/alerts/:id/resolve',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_SECURITY_ALERTS_VIEW),
      schema: { params: UuidParamsSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        const alert = await service.resolveAlert(req.params.id, user.tenant_id);
        fireAuditEvent({
          tenant_id: user.tenant_id,
          actor_id: user.sub,
          actor_role: user.role,
          action: 'security_alert.resolved',
          resource_type: 'security_alert',
          resource_id: alert.id,
        });
        return { data: alert };
      } catch (err) {
        if (err instanceof AlertNotFoundError) return sendNotFound(reply, err.message);
        throw err;
      }
    },
  );

  app.post(
    '/security/alerts/:id/dismiss',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_SECURITY_ALERTS_VIEW),
      schema: { params: UuidParamsSchema },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      try {
        return { data: await service.dismissAlert(req.params.id, user.tenant_id) };
      } catch (err) {
        if (err instanceof AlertNotFoundError) return sendNotFound(reply, err.message);
        throw err;
      }
    },
  );
};
