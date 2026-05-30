import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { db } from '../db/client.js';

/**
 * Prometheus-format metrics endpoint.
 *
 * Exposes operational counters and gauges that are derivable from PostgreSQL
 * without requiring an external metrics agent.
 *
 * Scrape target: GET /metrics
 * Content-Type: text/plain; version=0.0.4
 *
 * Note: For production deployments with high scrape frequency or cardinality,
 * replace this with prom-client + a dedicated sidecar or use the OpenTelemetry
 * collector pointing at the PostgreSQL exporter.
 */
export const metricsController: FastifyPluginAsyncZod = async (app) => {
  app.get('/', async (_req, reply) => {
    const lines: string[] = [];

    const append = (name: string, help: string, type: string, value: string | number) => {
      lines.push(`# HELP ${name} ${help}`);
      lines.push(`# TYPE ${name} ${type}`);
      lines.push(`${name} ${value}`);
    };

    try {
      // Active IVR sessions
      const ivrSessions = await db.query<{ status: string; count: string }>(
        `SELECT status, COUNT(*) AS count FROM ivr_flow_sessions
         WHERE created_at > NOW() - INTERVAL '1 hour'
         GROUP BY status`,
      );
      for (const row of ivrSessions.rows) {
        append(
          `managecallai_ivr_sessions_total`,
          `Total IVR flow sessions in the last hour by status`,
          'gauge',
          `${row.count}{status="${row.status}"}`,
        );
      }

      // Webhook delivery queue depth
      const webhookQueue = await db.query<{ status: string; count: string }>(
        `SELECT status, COUNT(*) AS count FROM webhook_delivery_queue GROUP BY status`,
      );
      for (const row of webhookQueue.rows) {
        append(
          `managecallai_webhook_queue_depth`,
          `Number of webhook delivery queue items by status`,
          'gauge',
          `${row.count}{status="${row.status}"}`,
        );
      }

      // Recording analysis backlog
      const recAnalysis = await db.query<{ status: string; count: string }>(
        `SELECT status, COUNT(*) AS count FROM recording_analysis_requests
         WHERE status IN ('queued', 'processing') GROUP BY status`,
      );
      for (const row of recAnalysis.rows) {
        append(
          `managecallai_recording_analysis_backlog`,
          `Recording analysis requests in-flight by status`,
          'gauge',
          `${row.count}{status="${row.status}"}`,
        );
      }

      // Outbound call request statuses
      const outbound = await db.query<{ status: string; count: string }>(
        `SELECT status, COUNT(*) AS count FROM outbound_call_requests
         WHERE created_at > NOW() - INTERVAL '1 hour' GROUP BY status`,
      );
      for (const row of outbound.rows) {
        append(
          `managecallai_outbound_calls_total`,
          `Outbound call requests in the last hour by status`,
          'gauge',
          `${row.count}{status="${row.status}"}`,
        );
      }

      // Tenant count
      const tenants = await db.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM tenants WHERE status = 'active'`,
      );
      append(
        `managecallai_active_tenants`,
        `Number of active tenants`,
        'gauge',
        tenants.rows[0]?.count ?? '0',
      );

    } catch (err) {
      lines.push(`# ERROR collecting metrics: ${(err as Error).message}`);
    }

    return reply
      .header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
      .send(lines.join('\n') + '\n');
  });
};
