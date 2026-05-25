function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const config = {
  port: parseInt(process.env['WORKER_PORT'] ?? '3400', 10),
  apiBaseUrl: required('API_BASE_URL').replace(/\/$/, ''),
} as const;
