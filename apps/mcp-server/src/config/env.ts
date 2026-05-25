function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const config = {
  apiBaseUrl: required('API_BASE_URL').replace(/\/$/, ''),
} as const;
