import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  port: parseInt(process.env['WORKER_PORT'] ?? '3400', 10),
  apiBaseUrl: required('API_BASE_URL').replace(/\/$/, ''),
  databaseUrl: process.env['DATABASE_URL'] ?? '',
} as const;
