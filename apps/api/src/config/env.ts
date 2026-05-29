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

export const config = {
  port: parseInt(process.env['API_PORT'] ?? '3000', 10),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  runtimeApiToken: required('RUNTIME_API_TOKEN'),
  sipSecretMasterKey: required('SIP_SECRET_MASTER_KEY'),
  sipSecretKeyId: required('SIP_SECRET_KEY_ID'),
  platformOperatorEmails: (process.env['PLATFORM_OPERATOR_EMAILS'] ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean),
  platformApiHealthUrl: process.env['PLATFORM_API_HEALTH_URL'] ?? 'http://localhost:3000/health',
  platformWorkerHealthUrl: process.env['PLATFORM_WORKER_HEALTH_URL'] ?? 'http://localhost:3400/health',
  webhookWorkerIntervalMs: parseInt(process.env['WEBHOOK_WORKER_INTERVAL_MS'] ?? '1000', 10),
  recordingStorageRoot: resolve(process.env['RECORDING_STORAGE_ROOT'] ?? 'recordings'),
} as const;
