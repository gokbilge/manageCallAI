import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { db } from '../../db/client.js';
import { config } from '../../config/env.js';
import type { SetupCompleteBody, SetupValidateBody } from './setup.types.js';
import {
  createPlatformAdmin,
  isSetupComplete,
  normalizeTenantSlug,
  runMigrations,
  testDbConnection,
  testEslConnection,
  validateSetupBody,
} from './setup.service.js';

function readSetupHtml(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(currentDir, 'setup.html'),
    join(currentDir, '../../src/modules/setup/setup.html'),
  ];
  const match = candidates.find((candidate) => existsSync(candidate));
  if (!match) {
    throw new Error('setup.html not found');
  }
  return readFileSync(match, 'utf8');
}

const SETUP_HTML = readSetupHtml();

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const rateLimitState = new Map<string, { count: number; resetAt: number }>();

function isLocalRequest(ip: string): boolean {
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

function enforceSetupRateLimit(ip: string): boolean {
  const now = Date.now();
  const current = rateLimitState.get(ip);
  if (!current || current.resetAt <= now) {
    rateLimitState.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (current.count >= RATE_LIMIT_MAX) return false;
  current.count += 1;
  return true;
}

export const setupController: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', async (req, reply) => {
    if (await isSetupComplete(db)) {
      return reply.code(404).send({ error: 'Not Found' });
    }

    if (config.isProduction && !config.allowRemoteSetup && !isLocalRequest(req.ip)) {
      return reply.code(403).send({ error: 'Remote setup is disabled' });
    }

    reply.header('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'");

    if (req.method !== 'GET' && !enforceSetupRateLimit(req.ip)) {
      return reply.code(429).send({ error: 'Too many setup attempts. Retry in one minute.' });
    }
  });

  app.get('/', async (_req, reply) => {
    reply.type('text/html; charset=utf-8');
    return reply.send(SETUP_HTML);
  });

  app.post<{ Body: SetupValidateBody }>('/validate', async (req, reply) => {
    if (req.body?.type === 'db') {
      const result = await testDbConnection(db);
      return reply.code(result.ok ? 200 : 400).send(result);
    }

    if (req.body?.type === 'esl') {
      const eslHost = req.body.eslHost?.trim() || process.env['FREESWITCH_ESL_HOST'] || '127.0.0.1';
      const eslPort = Number(req.body.eslPort || process.env['FREESWITCH_ESL_PORT'] || 8021);
      const eslPassword = req.body.eslPassword?.trim() || process.env['FREESWITCH_ESL_PASSWORD'] || '';
      if (!eslPassword) {
        return reply.code(400).send({ ok: false, error: 'eslPassword is required' });
      }
      const result = await testEslConnection(eslHost, eslPort, eslPassword);
      return reply.code(result.ok ? 200 : 400).send(result);
    }

    return reply.code(400).send({ error: 'type must be db or esl' });
  });

  app.post<{ Body: SetupCompleteBody }>('/complete', async (req, reply) => {
    const tenantName = req.body?.tenantName?.trim() || 'Platform';
    const tenantSlug = normalizeTenantSlug(req.body?.tenantSlug?.trim() || 'platform');
    const adminEmail = req.body?.adminEmail?.trim() || '';
    const adminPassword = req.body?.adminPassword || '';

    const errors = validateSetupBody({ tenantName, tenantSlug, adminEmail, adminPassword });
    if (errors.length > 0) {
      return reply.code(400).send({ error: 'Invalid setup input', details: errors });
    }

    if (!config.platformOperatorEmails.includes(adminEmail.toLowerCase())) {
      return reply.code(400).send({
        error: 'adminEmail must be listed in PLATFORM_OPERATOR_EMAILS before setup completes',
      });
    }

    await runMigrations();
    const result = await createPlatformAdmin(db, {
      tenantName,
      tenantSlug,
      adminEmail,
      adminPassword,
    });

    return reply.code(200).send({
      ok: true,
      data: {
        tenant_slug: result.tenantSlug,
        admin_email: result.adminEmail,
      },
    });
  });
};
