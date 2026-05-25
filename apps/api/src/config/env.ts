function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const config = {
  port: parseInt(process.env['API_PORT'] ?? '3000', 10),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  freeswitchDirectoryDefaultPassword:
    process.env['FREESWITCH_DIRECTORY_DEFAULT_PASSWORD'] ?? 'ChangeMe123!',
} as const;
