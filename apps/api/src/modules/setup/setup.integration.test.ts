import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

describe('setup bootstrap integration', () => {
  let app: FastifyInstance;
  let db: Pool;

  beforeAll(async () => {
    process.env.RUNTIME_API_TOKEN ??= 'test-runtime-token-that-is-long-enough';
    process.env.JWT_SECRET ??= 'test-jwt-secret-that-is-long-enough';
    process.env.SIP_SECRET_MASTER_KEY ??=
      'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    process.env.SIP_SECRET_KEY_ID ??= 'test-v1';
    process.env.PLATFORM_OPERATOR_EMAILS = 'setup-admin@example.com';
    process.env.ALLOW_REMOTE_SETUP = 'true';

    const appModule = await import('../../app.js');
    const { runMigrations } = await import('./setup.service.js');
    await runMigrations();
    ({ db } = await import('../../db/client.js'));
    await db.query(`DELETE FROM system_config WHERE key = 'setup_complete'`);
    await db.query(`TRUNCATE TABLE tenants CASCADE`);
    app = appModule.buildApp();
    await appModule.runBootstrapIfNeeded(app);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await db.end();
  });

  beforeEach(async () => {
    await db.query(`DELETE FROM system_config WHERE key = 'setup_complete'`);
    await db.query(`TRUNCATE TABLE tenants CASCADE`);
  });

  it('serves /setup while the sentinel is absent', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/setup',
      remoteAddress: '127.0.0.1',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('manageCallAI setup');
  });

  it('locks /setup after completing bootstrap', async () => {
    const suffix = randomUUID().slice(0, 8);
    const res = await app.inject({
      method: 'POST',
      url: '/setup/complete',
      remoteAddress: '127.0.0.1',
      payload: {
        tenantName: `Platform ${suffix}`,
        tenantSlug: `platform-${suffix}`,
        adminEmail: 'setup-admin@example.com',
        adminPassword: 'SuperSecret123!',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      ok: true,
      data: {
        tenant_slug: `platform-${suffix}`,
        admin_email: 'setup-admin@example.com',
      },
    });

    const sentinel = await db.query<{ value: string }>(
      `SELECT value FROM system_config WHERE key = 'setup_complete'`,
    );
    expect(sentinel.rows[0]?.value).toBe('true');

    const locked = await app.inject({
      method: 'GET',
      url: '/setup',
      remoteAddress: '127.0.0.1',
    });
    expect(locked.statusCode).toBe(404);
  });

  it('returns 400 when admin email is not allowlisted for platform access', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/setup/complete',
      remoteAddress: '127.0.0.1',
      payload: {
        tenantName: 'Platform',
        tenantSlug: 'platform',
        adminEmail: 'not-allowed@example.com',
        adminPassword: 'SuperSecret123!',
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.body).toContain('PLATFORM_OPERATOR_EMAILS');
  });

  it('runs the headless bootstrap path idempotently', async () => {
    const { runHeadlessBootstrap, isSetupComplete } = await import('./setup.service.js');
    const result = await runHeadlessBootstrap(db, {
      tenantName: 'Platform',
      tenantSlug: 'platform',
      adminEmail: 'setup-admin@example.com',
      adminPassword: 'SuperSecret123!',
    });

    expect(result).toMatchObject({
      tenantSlug: 'platform',
      adminEmail: 'setup-admin@example.com',
    });
    expect(await isSetupComplete(db)).toBe(true);

    const second = await runHeadlessBootstrap(db, {
      tenantName: 'Platform',
      tenantSlug: 'platform',
      adminEmail: 'setup-admin@example.com',
      adminPassword: 'SuperSecret123!',
    });
    expect(second).toBeNull();
  });
});
