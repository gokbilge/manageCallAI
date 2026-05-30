import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { db } from '../db/client.js';
import { CAPABILITIES } from '../modules/auth/capabilities.js';
import { requireCapability } from '../modules/auth/require-capability.js';
import type { AuthClaims } from '../modules/auth/auth-claims.js';

/**
 * Support bundle export endpoint.
 *
 * Returns a JSON snapshot useful for diagnosing operational issues:
 *   - Recent errors from the audit log
 *   - Call timeline for the last N calls
 *   - Active IVR sessions
 *   - Webhook queue summary
 *   - FreeSWITCH agent heartbeat
 *   - System version info
 *
 * All secret values (passwords, keys) are redacted. The bundle never contains
 * raw SIP credentials, JWT secrets, or API key values.
 *
 * Platform admin only: GET /api/v1/support/bundle
 * Tenant scope: GET /api/v1/support/bundle?tenant_id=<uuid> (platform admin)
 *               GET /api/v1/support/bundle (tenant admin, own tenant)
 */
export const supportController: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/bundle',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_AUDIT_LOG_VIEW),
      schema: {
        querystring: z.object({
          tenant_id: z.string().uuid().optional(),
          call_limit: z.coerce.number().int().min(1).max(50).default(10),
        }),
      },
    },
    async (req, reply) => {
      const user = req.user as AuthClaims;
      const tenantId = req.query.tenant_id ?? user.tenant_id;
      const callLimit = req.query.call_limit;

      // Platform admins can query any tenant; tenant admins only their own.
      if (req.query.tenant_id && req.query.tenant_id !== user.tenant_id) {
        if (!hasCapability(user, CAPABILITIES.PLATFORM_AUDIT_VIEW)) {
          return reply.code(403).send({ error: 'PERMISSION_DENIED', message: 'Platform audit view required' });
        }
      }

      const [
        recentErrors,
        recentCalls,
        ivrSessions,
        webhookSummary,
        agentHeartbeat,
      ] = await Promise.all([
        getRecentErrors(tenantId),
        getRecentCallTimeline(tenantId, callLimit),
        getActiveIvrSessions(tenantId),
        getWebhookQueueSummary(tenantId),
        getAgentHeartbeat(),
      ]);

      return {
        generated_at: new Date().toISOString(),
        version: process.env['npm_package_version'] ?? 'unknown',
        tenant_id: tenantId,
        recent_errors: recentErrors,
        recent_calls: recentCalls,
        active_ivr_sessions: ivrSessions,
        webhook_queue: webhookSummary,
        freeswitch_agent: agentHeartbeat,
      };
    },
  );
};

function hasCapability(user: AuthClaims, capability: string): boolean {
  if (user.capabilities) return user.capabilities.includes(capability) || user.capabilities.includes('*');
  return user.role === 'platform_admin';
}

async function getRecentErrors(tenantId: string) {
  const r = await db.query<{ action: string; resource_type: string; created_at: Date }>(
    `SELECT action, resource_type, created_at
     FROM tenant_audit_log
     WHERE tenant_id = $1 AND action LIKE '%.failed' OR action LIKE '%.error'
     ORDER BY created_at DESC LIMIT 20`,
    [tenantId],
  );
  return r.rows;
}

async function getRecentCallTimeline(tenantId: string, limit: number) {
  const r = await db.query<{ call_id: string; event_type: string; event_time: Date; source: string | null }>(
    `SELECT call_id, event_type, event_time, source
     FROM call_events
     WHERE tenant_id = $1
     ORDER BY event_time DESC
     LIMIT $2`,
    [tenantId, limit],
  );
  return r.rows;
}

async function getActiveIvrSessions(tenantId: string) {
  const r = await db.query<{ id: string; flow_id: string; call_id: string; status: string; current_node_id: string | null; created_at: Date }>(
    `SELECT id, flow_id, call_id, status, current_node_id, created_at
     FROM ivr_flow_sessions
     WHERE tenant_id = $1 AND status = 'running'
     ORDER BY created_at DESC`,
    [tenantId],
  );
  return r.rows;
}

async function getWebhookQueueSummary(tenantId: string) {
  const r = await db.query<{ status: string; count: string }>(
    `SELECT status, COUNT(*) AS count
     FROM webhook_delivery_queue
     WHERE tenant_id = $1
     GROUP BY status`,
    [tenantId],
  );
  return r.rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = parseInt(row.count, 10);
    return acc;
  }, {});
}

async function getAgentHeartbeat() {
  try {
    const r = await db.query<{ agent_id: string; esl_connected: boolean; reported_at: Date }>(
      `SELECT agent_id, esl_connected, reported_at
       FROM runtime_health_checks
       ORDER BY reported_at DESC LIMIT 1`,
    );
    return r.rows[0] ?? null;
  } catch {
    return null;
  }
}
