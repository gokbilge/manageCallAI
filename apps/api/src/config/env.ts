import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Walk up from apps/api/src/config/ → apps/api/src/ → apps/api/ → apps/ → repo root
const rootEnv = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../.env');
if (existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
}

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

const defaultJwtSecret = 'change-me-to-a-long-random-string-in-production';
const defaultRuntimeApiToken = 'change-me-runtime-token';
const defaultSipSecretMasterKey =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function parseBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined || value.trim() === '') return defaultValue;

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function parsePositiveInt(key: string, defaultValue: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw.trim() === '') return defaultValue;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${key} must be a positive integer`);
  }
  return value;
}

function assertProductionSecret(
  name: string,
  value: string,
  disallowedValue: string,
  minimumLength: number,
): void {
  if (value === disallowedValue || value.length < minimumLength) {
    throw new Error(
      `${name} must be changed to a strong production value when APP_ENV=production`,
    );
  }
}

const appEnv = process.env['APP_ENV'] ?? 'development';
const isProduction = appEnv === 'production';

const configValues = {
  appEnv,
  isProduction,
  port: parseInt(process.env['API_PORT'] ?? '3000', 10),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  runtimeApiToken: required('RUNTIME_API_TOKEN'),
  // Optional secondary token accepted during zero-downtime rotation (SLICE-46).
  // Set to the new token, roll it out to nodes, then promote to primary and clear this.
  runtimeApiTokenSecondary: process.env['RUNTIME_API_TOKEN_SECONDARY'] ?? null,
  sipSecretMasterKey: required('SIP_SECRET_MASTER_KEY'),
  sipSecretKeyId: required('SIP_SECRET_KEY_ID'),
  allowRuntimeTokenFallback: parseBoolean('ALLOW_RUNTIME_TOKEN_FALLBACK', !isProduction),
  platformOperatorEmails: (process.env['PLATFORM_OPERATOR_EMAILS'] ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
  platformApiHealthUrl: process.env['PLATFORM_API_HEALTH_URL'] ?? 'http://localhost:3000/health',
  platformWorkerHealthUrl: process.env['PLATFORM_WORKER_HEALTH_URL'] ?? 'http://localhost:3400/health',
  platformFreeswitchAgentHealthUrl:
    process.env['PLATFORM_FREESWITCH_AGENT_HEALTH_URL'] ?? 'http://localhost:3500/health',
  allowRemoteSetup: parseBoolean('ALLOW_REMOTE_SETUP', false),
  setupAdminEmail: process.env['SETUP_ADMIN_EMAIL']?.trim() || null,
  setupAdminPassword: process.env['SETUP_ADMIN_PASSWORD'] ?? null,
  setupTenantName: process.env['SETUP_TENANT_NAME']?.trim() || null,
  setupTenantSlug: process.env['SETUP_TENANT_SLUG']?.trim() || null,
  webhookWorkerIntervalMs: parseInt(process.env['WEBHOOK_WORKER_INTERVAL_MS'] ?? '1000', 10),
  recordingStorageRoot: resolve(process.env['RECORDING_STORAGE_ROOT'] ?? 'recordings'),
  rateLimitWindowMs: parsePositiveInt('RATE_LIMIT_WINDOW_MS', 60_000),
  rateLimitAuthMax: parsePositiveInt('RATE_LIMIT_AUTH_MAX', 100),
  rateLimitRuntimeMax: parsePositiveInt('RATE_LIMIT_RUNTIME_MAX', 1_200),
  rateLimitWebhookMax: parsePositiveInt('RATE_LIMIT_WEBHOOK_MAX', 300),
  rateLimitOutboundMax: parsePositiveInt('RATE_LIMIT_OUTBOUND_MAX', 60),
  rateLimitApiMax: parsePositiveInt('RATE_LIMIT_API_MAX', 600),
  rateLimitScrapeMax: parsePositiveInt('RATE_LIMIT_SCRAPE_MAX', 30),
  rateLimitStore: process.env['RATE_LIMIT_STORE'] ?? 'memory',
  rateLimitRedisUrl: process.env['RATE_LIMIT_REDIS_URL'] ?? null,
  rateLimitRedisKeyPrefix: process.env['RATE_LIMIT_REDIS_KEY_PREFIX'] ?? 'managecallai:rate-limit',
} as const;

if (configValues.isProduction) {
  assertProductionSecret('JWT_SECRET', configValues.jwtSecret, defaultJwtSecret, 32);
  assertProductionSecret(
    'RUNTIME_API_TOKEN',
    configValues.runtimeApiToken,
    defaultRuntimeApiToken,
    32,
  );
  assertProductionSecret(
    'SIP_SECRET_MASTER_KEY',
    configValues.sipSecretMasterKey,
    defaultSipSecretMasterKey,
    64,
  );
}

export const config = configValues;
