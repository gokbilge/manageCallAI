import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const createPlatformAdmin = vi.fn();
const isSetupComplete = vi.fn();
const normalizeTenantSlug = vi.fn((value: string) => value);
const runMigrations = vi.fn();
const testDbConnection = vi.fn();
const testEslConnection = vi.fn();
const validateSetupBody = vi.fn(() => []);

vi.mock('../../db/client.js', () => ({
  db: {},
}));

vi.mock('../../config/env.js', () => ({
  config: {
    isProduction: false,
    allowRemoteSetup: false,
    platformOperatorEmails: ['admin@example.com'],
  },
}));

vi.mock('./setup.service.js', () => ({
  createPlatformAdmin,
  isSetupComplete,
  normalizeTenantSlug,
  runMigrations,
  testDbConnection,
  testEslConnection,
  validateSetupBody,
}));

describe('setupController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSetupComplete.mockResolvedValue(false);
  });

  afterEach(async () => {
    vi.resetModules();
  });

  async function buildTestApp() {
    const { setupController } = await import('./setup.controller.js');
    const app = Fastify();
    await app.register(setupController, { prefix: '/setup' });
    return app;
  }

  it('validates the database connection', async () => {
    testDbConnection.mockResolvedValue({ ok: true, pendingMigrations: 2 });

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/setup/validate',
      payload: { type: 'db' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, pendingMigrations: 2 });
    await app.close();
  });

  it('rejects ESL validation when no password is provided', async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/setup/validate',
      payload: { type: 'esl', eslHost: '10.0.0.1', eslPort: 8021 },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ ok: false, error: 'eslPassword is required' });
    expect(testEslConnection).not.toHaveBeenCalled();
    await app.close();
  });

  it('returns the ESL connectivity result when a password is provided', async () => {
    testEslConnection.mockResolvedValue({ ok: false, error: 'authentication rejected' });

    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/setup/validate',
      payload: { type: 'esl', eslHost: '10.0.0.1', eslPort: 8021, eslPassword: 'ClueCon' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ ok: false, error: 'authentication rejected' });
    expect(testEslConnection).toHaveBeenCalledWith('10.0.0.1', 8021, 'ClueCon');
    await app.close();
  });

  it('rejects unknown validation types', async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/setup/validate',
      payload: { type: 'unknown' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'type must be db or esl' });
    await app.close();
  });

  it('rate limits repeated non-GET setup requests', async () => {
    testDbConnection.mockResolvedValue({ ok: true, pendingMigrations: 0 });

    const app = await buildTestApp();
    for (let i = 0; i < 5; i += 1) {
      const response = await app.inject({
        method: 'POST',
        url: '/setup/validate',
        payload: { type: 'db' },
      });
      expect(response.statusCode).toBe(200);
    }

    const limited = await app.inject({
      method: 'POST',
      url: '/setup/validate',
      payload: { type: 'db' },
    });

    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toEqual({ error: 'Too many setup attempts. Retry in one minute.' });
    await app.close();
  });
});
