import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import type { Pool } from 'pg';
import type { HeadlessBootstrapVars, SetupCompletionResult } from './setup.types.js';

const BCRYPT_ROUNDS = 12;
const MIN_TOKEN_LENGTH = 32;
const DEFAULT_TENANT_NAME = 'Platform';
const DEFAULT_TENANT_SLUG = 'platform';
const execFileAsync = promisify(execFile);
const DISALLOWED_SECRETS = new Set([
  'change-me-to-a-long-random-string-in-production',
  'change-me-runtime-token',
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
]);

function repoRootFromModule(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '../../../../../');
}

function migrationsDir(): string {
  return join(repoRootFromModule(), 'db/migrations');
}

function migrationScriptPath(): string {
  return join(repoRootFromModule(), 'db/migrate.mjs');
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeTenantSlug(slug: string): string {
  return slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function isMissingTableError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === '42P01';
}

export function generateSecret(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

export async function isSetupComplete(db: Pool): Promise<boolean> {
  try {
    const r = await db.query<{ value: string }>(
      `SELECT value FROM system_config WHERE key = 'setup_complete'`,
    );
    return r.rows[0]?.value === 'true';
  } catch (err) {
    if (isMissingTableError(err)) return false;
    throw err;
  }
}

export async function writeSentinel(db: Pool): Promise<void> {
  await db.query(
    `INSERT INTO system_config (key, value) VALUES ('setup_complete', 'true')
     ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = NOW()`,
  );
}

export async function countPendingMigrations(db: Pool): Promise<number> {
  try {
    const applied = await db.query<{ filename: string }>(
      `SELECT filename FROM schema_migrations ORDER BY filename`,
    );
    const appliedSet = new Set(applied.rows.map((r) => r.filename));
    const files = (await readdir(migrationsDir()))
      .filter((f) => f.endsWith('.sql'))
      .sort();
    return files.filter((f) => !appliedSet.has(f)).length;
  } catch {
    return 0;
  }
}

export function validateSecret(value: string, minLength = MIN_TOKEN_LENGTH): boolean {
  return typeof value === 'string' && value.length >= minLength && !DISALLOWED_SECRETS.has(value);
}

export function validateSetupBody(body: {
  tenantName?: unknown;
  tenantSlug?: unknown;
  adminEmail?: unknown;
  adminPassword?: unknown;
}): string[] {
  const errors: string[] = [];
  const tenantName =
    typeof body.tenantName === 'string' && body.tenantName.trim().length > 0
      ? body.tenantName.trim()
      : DEFAULT_TENANT_NAME;
  const tenantSlug =
    typeof body.tenantSlug === 'string' && body.tenantSlug.trim().length > 0
      ? normalizeTenantSlug(body.tenantSlug)
      : DEFAULT_TENANT_SLUG;

  if (tenantName.length < 2) {
    errors.push('tenantName must be at least 2 characters');
  }
  if (!tenantSlug || tenantSlug.length < 2) {
    errors.push('tenantSlug must contain at least 2 URL-safe characters');
  }
  if (!body.adminEmail || typeof body.adminEmail !== 'string' || !body.adminEmail.includes('@')) {
    errors.push('adminEmail must be a valid email address');
  }
  if (
    !body.adminPassword ||
    typeof body.adminPassword !== 'string' ||
    body.adminPassword.length < 12
  ) {
    errors.push('adminPassword must be at least 12 characters');
  }
  return errors;
}

export function getHeadlessBootstrapVarsFromEnv(): HeadlessBootstrapVars | null {
  const adminEmail = process.env['SETUP_ADMIN_EMAIL']?.trim();
  const adminPassword = process.env['SETUP_ADMIN_PASSWORD'];
  if (!adminEmail || !adminPassword) return null;

  if (
    !validateSecret(process.env['JWT_SECRET'] ?? '') ||
    !validateSecret(process.env['RUNTIME_API_TOKEN'] ?? '') ||
    !validateSecret(process.env['SIP_SECRET_MASTER_KEY'] ?? '', 64)
  ) {
    return null;
  }

  const tenantName = process.env['SETUP_TENANT_NAME']?.trim() || DEFAULT_TENANT_NAME;
  const tenantSlug = normalizeTenantSlug(process.env['SETUP_TENANT_SLUG']?.trim() || DEFAULT_TENANT_SLUG);

  if (validateSetupBody({ tenantName, tenantSlug, adminEmail, adminPassword }).length > 0) {
    return null;
  }

  return { tenantName, tenantSlug, adminEmail, adminPassword };
}

export async function createPlatformAdmin(
  db: Pool,
  input: HeadlessBootstrapVars,
): Promise<SetupCompletionResult> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const tenantResult = await client.query<{ id: string; slug: string }>(
      `INSERT INTO tenants (name, slug, directory_domain)
       VALUES ($1, $2, $3)
       ON CONFLICT (slug)
       DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
       RETURNING id, slug`,
      [input.tenantName, input.tenantSlug, `${input.tenantSlug}.managecallai.local`],
    );
    const tenant = tenantResult.rows[0]!;
    const passwordHash = await bcrypt.hash(input.adminPassword, BCRYPT_ROUNDS);

    const userResult = await client.query<{ id: string }>(
      `INSERT INTO users (tenant_id, email, password_hash, role, display_name)
       VALUES ($1, $2, $3, 'tenant_admin', 'Platform Admin')
       ON CONFLICT (tenant_id, email)
       DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = NOW()
       RETURNING id`,
      [tenant.id, normalizeEmail(input.adminEmail), passwordHash],
    );

    if (!userResult.rows[0]?.id) {
      throw new Error('Failed to create or update bootstrap admin');
    }

    await client.query(
      `INSERT INTO system_config (key, value) VALUES ('setup_complete', 'true')
       ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = NOW()`,
    );

    await client.query('COMMIT');
    return {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      adminEmail: normalizeEmail(input.adminEmail),
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function runMigrations(): Promise<void> {
  const script = migrationScriptPath();
  await execFileAsync(process.execPath, [script], {
    cwd: repoRootFromModule(),
    env: process.env,
  });
}

export async function runHeadlessBootstrap(
  db: Pool,
  vars: HeadlessBootstrapVars,
): Promise<SetupCompletionResult | null> {
  await runMigrations();
  if (await isSetupComplete(db)) {
    process.env['SETUP_ADMIN_PASSWORD'] = '';
    return null;
  }
  const result = await createPlatformAdmin(db, vars);
  process.env['SETUP_ADMIN_PASSWORD'] = '';
  return result;
}

export async function testDbConnection(
  db: Pool,
): Promise<{ ok: boolean; pendingMigrations: number; error?: string }> {
  try {
    await db.query('SELECT 1');
    return { ok: true, pendingMigrations: await countPendingMigrations(db) };
  } catch (err) {
    return {
      ok: false,
      pendingMigrations: 0,
      error: err instanceof Error ? err.message : 'database connection failed',
    };
  }
}

export async function testEslConnection(
  host: string,
  port: number,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  const net = await import('node:net');
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port, family: 4 });
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve({ ok: false, error: 'connection timed out (5s)' });
    }, 5000);

    socket.once('data', (data) => {
      const text = data.toString();
      if (text.includes('auth/request')) {
        socket.write(`auth ${password}\n\n`);
      } else if (text.includes('+OK accepted')) {
        clearTimeout(timeout);
        socket.destroy();
        resolve({ ok: true });
      } else if (text.includes('-ERR invalid') || text.includes('+OK')) {
        const ok = text.includes('+OK');
        clearTimeout(timeout);
        socket.destroy();
        resolve({ ok, error: ok ? undefined : 'authentication rejected' });
      }
    });

    socket.once('error', (err) => {
      clearTimeout(timeout);
      resolve({ ok: false, error: err.message });
    });
  });
}
