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
  apiBaseUrl: required('API_BASE_URL').replace(/\/$/, ''),
  // Prefer MANAGECALL_API_KEY (API-key auth). Legacy MANAGECALL_ACCESS_TOKEN
  // (JWT passed as a tool argument) is deprecated — see SLICE-38/41.
  apiKey: process.env['MANAGECALL_API_KEY'] ?? '',
} as const;
