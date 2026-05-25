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
} as const;
