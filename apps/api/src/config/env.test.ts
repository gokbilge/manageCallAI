import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

function resetEnv(overrides: NodeJS.ProcessEnv): void {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }

  Object.assign(process.env, originalEnv, {
    DATABASE_URL: 'postgres://managecallai:managecallai@localhost:5432/managecallai',
    JWT_SECRET: 'test-jwt-secret-that-is-long-enough',
    RUNTIME_API_TOKEN: 'test-runtime-token-that-is-long-enough',
    SIP_SECRET_MASTER_KEY: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    SIP_SECRET_KEY_ID: 'v1',
  }, overrides);
}

async function loadConfig(overrides: NodeJS.ProcessEnv = {}) {
  vi.resetModules();
  resetEnv(overrides);
  return import('./env.js');
}

afterEach(() => {
  vi.resetModules();
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
});

describe('config', () => {
  it('allows runtime token fallback outside production by default', async () => {
    const { config } = await loadConfig({ APP_ENV: 'development' });

    expect(config.isProduction).toBe(false);
    expect(config.allowRuntimeTokenFallback).toBe(true);
  });

  it('disables runtime token fallback in production by default', async () => {
    const { config } = await loadConfig({ APP_ENV: 'production' });

    expect(config.isProduction).toBe(true);
    expect(config.allowRuntimeTokenFallback).toBe(false);
  });

  it('rejects sample API secrets in production', async () => {
    await expect(loadConfig({
      APP_ENV: 'production',
      JWT_SECRET: 'change-me-to-a-long-random-string-in-production',
    })).rejects.toThrow('JWT_SECRET must be changed');

    await expect(loadConfig({
      APP_ENV: 'production',
      RUNTIME_API_TOKEN: 'change-me-runtime-token',
    })).rejects.toThrow('RUNTIME_API_TOKEN must be changed');

    await expect(loadConfig({
      APP_ENV: 'production',
      SIP_SECRET_MASTER_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    })).rejects.toThrow('SIP_SECRET_MASTER_KEY must be changed');
  });
});
