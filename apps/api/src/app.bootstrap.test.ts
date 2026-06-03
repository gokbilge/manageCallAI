import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const isSetupComplete = vi.fn();
const getHeadlessBootstrapVarsFromEnv = vi.fn();
const runHeadlessBootstrap = vi.fn();

vi.mock('./config/env.js', () => ({
  config: {
    platformOperatorEmails: ['admin@example.com'],
  },
}));

vi.mock('./db/client.js', () => ({
  db: {},
}));

vi.mock('./modules/setup/setup.service.js', () => ({
  getHeadlessBootstrapVarsFromEnv,
  isSetupComplete,
  runHeadlessBootstrap,
}));

vi.mock('./modules/setup/setup.controller.js', () => ({
  setupController: async (app: ReturnType<typeof Fastify>) => {
    app.get('/', async () => ({ ok: true }));
  },
}));

describe('runBootstrapIfNeeded', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns immediately when setup is already complete', async () => {
    isSetupComplete.mockResolvedValue(true);
    getHeadlessBootstrapVarsFromEnv.mockReturnValue(null);

    const { runBootstrapIfNeeded } = await import('./app.js');
    const app = Fastify();

    await runBootstrapIfNeeded(app);

    const response = await app.inject({ method: 'GET', url: '/setup' });
    expect(response.statusCode).toBe(404);
    expect(runHeadlessBootstrap).not.toHaveBeenCalled();
    await app.close();
  });

  it('registers the setup route when setup is incomplete and no headless bootstrap env is present', async () => {
    isSetupComplete.mockResolvedValue(false);
    getHeadlessBootstrapVarsFromEnv.mockReturnValue(null);

    const { runBootstrapIfNeeded } = await import('./app.js');
    const app = Fastify();

    await runBootstrapIfNeeded(app);

    const response = await app.inject({ method: 'GET', url: '/setup' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    await app.close();
  });

  it('rejects headless bootstrap when the admin email is not allowlisted', async () => {
    isSetupComplete.mockResolvedValue(false);
    getHeadlessBootstrapVarsFromEnv.mockReturnValue({
      tenantName: 'Platform',
      tenantSlug: 'platform',
      adminEmail: 'other@example.com',
      adminPassword: 'supersecret123',
    });

    const { runBootstrapIfNeeded } = await import('./app.js');
    const app = Fastify();

    await expect(runBootstrapIfNeeded(app)).rejects.toThrow(
      'SETUP_ADMIN_EMAIL must be included in PLATFORM_OPERATOR_EMAILS before headless bootstrap runs',
    );
    await app.close();
  });

  it('runs headless bootstrap and logs completion for an allowlisted admin', async () => {
    isSetupComplete.mockResolvedValue(false);
    getHeadlessBootstrapVarsFromEnv.mockReturnValue({
      tenantName: 'Platform',
      tenantSlug: 'platform',
      adminEmail: 'admin@example.com',
      adminPassword: 'supersecret123',
    });
    runHeadlessBootstrap.mockResolvedValue({
      tenantId: 'tenant-1',
      tenantSlug: 'platform',
      adminEmail: 'admin@example.com',
    });

    const { runBootstrapIfNeeded } = await import('./app.js');
    const app = Fastify();
    const logSpy = vi.spyOn(app.log, 'info');

    await runBootstrapIfNeeded(app);

    expect(runHeadlessBootstrap).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      { adminEmail: 'admin@example.com', tenantSlug: 'platform' },
      'manageCallAI setup complete',
    );
    await app.close();
  });
});
