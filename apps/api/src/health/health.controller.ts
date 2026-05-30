import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { db } from '../db/client.js';
import { config } from '../config/env.js';

interface SubsystemStatus {
  status: 'ok' | 'degraded' | 'error';
  latency_ms?: number;
  detail?: string;
}

async function checkDb(): Promise<SubsystemStatus> {
  const start = Date.now();
  try {
    await db.query('SELECT 1');
    return { status: 'ok', latency_ms: Date.now() - start };
  } catch (err) {
    return { status: 'error', detail: (err as Error).message };
  }
}

async function checkWebhookQueue(): Promise<SubsystemStatus> {
  try {
    const r = await db.query<{ pending: string }>(
      `SELECT COUNT(*) AS pending FROM webhook_delivery_queue WHERE status = 'pending'`,
    );
    const pending = parseInt(r.rows[0]?.pending ?? '0', 10);
    return {
      status: pending > 1000 ? 'degraded' : 'ok',
      detail: `${pending} pending deliveries`,
    };
  } catch {
    return { status: 'error', detail: 'queue check failed' };
  }
}

export const healthController: FastifyPluginAsyncZod = async (app) => {
  app.get('/', async (_req, reply) => {
    const [dbStatus, queueStatus] = await Promise.all([checkDb(), checkWebhookQueue()]);

    const overall =
      dbStatus.status === 'error' ? 'error'
      : dbStatus.status === 'degraded' || queueStatus.status === 'degraded' ? 'degraded'
      : 'ok';

    const code = overall === 'ok' ? 200 : overall === 'degraded' ? 200 : 503;

    return reply.code(code).send({
      status: overall,
      version: process.env['npm_package_version'] ?? 'unknown',
      subsystems: {
        db: dbStatus,
        webhook_queue: queueStatus,
        // FreeSWITCH ESL connectivity is reported via runtime_health_checks written by the Go adapter.
        // Query the most recent heartbeat as a health signal.
        freeswitch_agent: await checkFreeSwitchAgent(),
      },
    });
  });

  // Liveness: just checks the process is alive. Used by k8s.
  app.get('/live', async (_req, reply) => reply.code(200).send({ status: 'ok' }));

  // Readiness: checks DB connectivity.
  app.get('/ready', async (_req, reply) => {
    const db_status = await checkDb();
    const code = db_status.status === 'ok' ? 200 : 503;
    return reply.code(code).send({ status: db_status.status, db: db_status });
  });
};

async function checkFreeSwitchAgent(): Promise<SubsystemStatus> {
  try {
    const r = await db.query<{ reported_at: Date; esl_connected: boolean }>(
      `SELECT reported_at, esl_connected
       FROM runtime_health_checks
       ORDER BY reported_at DESC
       LIMIT 1`,
    );
    const row = r.rows[0];
    if (!row) return { status: 'degraded', detail: 'no heartbeat received yet' };
    const ageSecs = (Date.now() - row.reported_at.getTime()) / 1000;
    if (ageSecs > 60) return { status: 'degraded', detail: `last heartbeat ${Math.round(ageSecs)}s ago` };
    if (!row.esl_connected) return { status: 'degraded', detail: 'ESL disconnected' };
    return { status: 'ok', detail: `heartbeat ${Math.round(ageSecs)}s ago` };
  } catch {
    // runtime_health_checks table may not exist yet (migrations not applied) — treat as unknown.
    return { status: 'ok', detail: 'health check table not available' };
  }
}

// Suppress unused import warning — config is used by the /metrics endpoint via process.env
void config;
