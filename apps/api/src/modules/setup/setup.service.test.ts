import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

function resetEnv(overrides: NodeJS.ProcessEnv = {}) {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnv, overrides);
}

afterEach(() => {
  vi.restoreAllMocks();
  resetEnv();
});

describe('setup.service', () => {
  it('normalizes tenant slugs and validates setup inputs', async () => {
    const service = await import('./setup.service.js');

    expect(service.normalizeTenantSlug('  Platform Ops  ')).toBe('platform-ops');
    expect(
      service.validateSetupBody({
        tenantName: 'P',
        tenantSlug: '!!!',
        adminEmail: 'bad-email',
        adminPassword: 'short',
      }),
    ).toEqual([
      'tenantName must be at least 2 characters',
      'tenantSlug must contain at least 2 URL-safe characters',
      'adminEmail must be a valid email address',
      'adminPassword must be at least 12 characters',
    ]);
  });

  it('validates secrets and reads headless bootstrap vars from env', async () => {
    const service = await import('./setup.service.js');

    resetEnv({
      JWT_SECRET: 'a'.repeat(32),
      RUNTIME_API_TOKEN: 'b'.repeat(32),
      SIP_SECRET_MASTER_KEY: 'c'.repeat(64),
      SETUP_TENANT_NAME: 'Platform',
      SETUP_TENANT_SLUG: 'platform',
      SETUP_ADMIN_EMAIL: 'Admin@Example.com',
      SETUP_ADMIN_PASSWORD: 'StrongPassword123!',
    });

    expect(service.validateSecret('a'.repeat(32))).toBe(true);
    expect(service.validateSecret('short')).toBe(false);

    expect(service.getHeadlessBootstrapVarsFromEnv()).toEqual({
      tenantName: 'Platform',
      tenantSlug: 'platform',
      adminEmail: 'Admin@Example.com',
      adminPassword: 'StrongPassword123!',
    });

    resetEnv({
      JWT_SECRET: 'change-me-to-a-long-random-string-in-production',
      RUNTIME_API_TOKEN: 'b'.repeat(32),
      SIP_SECRET_MASTER_KEY: 'c'.repeat(64),
      SETUP_ADMIN_EMAIL: 'admin@example.com',
      SETUP_ADMIN_PASSWORD: 'StrongPassword123!',
    });

    expect(service.getHeadlessBootstrapVarsFromEnv()).toBeNull();
  });

  it('treats missing system_config as incomplete and writes the sentinel', async () => {
    const service = await import('./setup.service.js');
    const query = vi
      .fn()
      .mockRejectedValueOnce({ code: '42P01' })
      .mockResolvedValueOnce({ rows: [{ value: 'true' }] })
      .mockResolvedValueOnce({});
    const db = { query } as unknown as Parameters<typeof service.isSetupComplete>[0];

    await expect(service.isSetupComplete(db)).resolves.toBe(false);
    await expect(service.isSetupComplete(db)).resolves.toBe(true);
    await expect(service.writeSentinel(db)).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledTimes(3);
  });

  it('counts pending migrations and handles database probe failures', async () => {
    const service = await import('./setup.service.js');
    const dbOk = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [{ filename: '0001_initial_schema.sql' }] })
        .mockResolvedValueOnce({ rows: [] }),
    } as unknown as Parameters<typeof service.countPendingMigrations>[0];

    const pending = await service.countPendingMigrations(dbOk);
    expect(typeof pending).toBe('number');
    expect(pending).toBeGreaterThanOrEqual(1);

    const dbFail = {
      query: vi.fn().mockRejectedValue(new Error('db down')),
    } as unknown as Parameters<typeof service.testDbConnection>[0];

    await expect(service.testDbConnection(dbFail)).resolves.toEqual({
      ok: false,
      pendingMigrations: 0,
      error: 'db down',
    });
  });

  it('creates bootstrap tenant/admin and makes headless bootstrap idempotent', async () => {
    const service = await import('./setup.service.js');
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [{ id: 'tenant-1', slug: 'platform' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'user-1' }] })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined),
      release: vi.fn(),
    };
    const db = {
      connect: vi.fn().mockResolvedValue(client),
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ value: 'true' }] }),
    } as unknown as Parameters<typeof service.createPlatformAdmin>[0];

    const created = await service.createPlatformAdmin(db, {
      tenantName: 'Platform',
      tenantSlug: 'platform',
      adminEmail: 'Admin@Example.com',
      adminPassword: 'StrongPassword123!',
    });

    expect(created).toEqual({
      tenantId: 'tenant-1',
      tenantSlug: 'platform',
      adminEmail: 'admin@example.com',
    });
    expect(client.query).toHaveBeenCalledWith('BEGIN');
    expect(client.release).toHaveBeenCalled();

    vi.spyOn(service, 'runMigrations').mockResolvedValue(undefined);
    const headlessClient = {
      query: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ rows: [{ id: 'tenant-1', slug: 'platform' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'user-1' }] })
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined),
      release: vi.fn(),
    };
    const headlessDb = {
      connect: vi.fn().mockResolvedValue(headlessClient),
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ value: 'true' }] }),
    } as unknown as Parameters<typeof service.createPlatformAdmin>[0];

    process.env.SETUP_ADMIN_PASSWORD = 'StrongPassword123!';
    await expect(
      service.runHeadlessBootstrap(headlessDb, {
        tenantName: 'Platform',
        tenantSlug: 'platform',
        adminEmail: 'admin@example.com',
        adminPassword: 'StrongPassword123!',
      }),
    ).resolves.toEqual(created);
    expect(process.env.SETUP_ADMIN_PASSWORD).toBe('');

    process.env.SETUP_ADMIN_PASSWORD = 'StrongPassword123!';
    await expect(
      service.runHeadlessBootstrap(headlessDb, {
        tenantName: 'Platform',
        tenantSlug: 'platform',
        adminEmail: 'admin@example.com',
        adminPassword: 'StrongPassword123!',
      }),
    ).resolves.toBeNull();
    expect(headlessDb.connect).toHaveBeenCalledTimes(1);
    expect(process.env.SETUP_ADMIN_PASSWORD).toBe('');
  });
});
