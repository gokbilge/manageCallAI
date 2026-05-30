import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

// ── App setup ─────────────────────────────────────────────────────────────────
// Mirrors the pattern used in platform.integration.test.ts:
// - Dynamic import after env is set so config is read correctly.
// - No network listener; all requests use Fastify inject.
// - beforeEach truncates tenants CASCADE so every test starts clean.

describe('Auth + Users integration', () => {
  let app: FastifyInstance;
  let db: Pool;

  beforeAll(async () => {
    process.env.RUNTIME_API_TOKEN ??= 'test-runtime-token';
    process.env.JWT_SECRET ??= 'test-jwt-secret';
    process.env.SIP_SECRET_MASTER_KEY ??=
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    process.env.SIP_SECRET_KEY_ID ??= 'test-v1';
    // Ensure no email is treated as platform_admin in these tests.
    process.env.PLATFORM_OPERATOR_EMAILS = '';

    const { buildApp } = await import('../../app.js');
    ({ db } = await import('../../db/client.js'));
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await db.end();
  });

  beforeEach(async () => {
    await db.query('TRUNCATE TABLE tenants CASCADE');
  });

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function uniqueSuffix(): string {
    return randomUUID().slice(0, 8);
  }

  async function register(slug: string, email: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: {
        tenant_name: `Tenant ${slug}`,
        tenant_slug: slug,
        email,
        display_name: 'Test User',
        password: 'Secret123!',
      },
    });
    expect(res.statusCode, `register failed for ${slug}: ${res.body}`).toBe(201);
    return res.json<{ token: string }>().token;
  }

  async function login(slug: string, email: string, password = 'Secret123!'): Promise<{ status: number; token?: string }> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { tenant_slug: slug, email, password },
    });
    return {
      status: res.statusCode,
      token: res.statusCode === 200 ? res.json<{ token: string }>().token : undefined,
    };
  }

  // ── Register ─────────────────────────────────────────────────────────────────

  describe('POST /auth/register', () => {
    it('creates a tenant and returns a JWT', async () => {
      const s = uniqueSuffix();
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          tenant_name: `Acme ${s}`,
          tenant_slug: `acme-${s}`,
          email: `admin-${s}@example.com`,
          display_name: 'Admin',
          password: 'Secret123!',
        },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json<{ token: string }>();
      expect(typeof body.token).toBe('string');
      expect(body.token.length).toBeGreaterThan(10);
    });

    it('returns 409 on duplicate tenant slug', async () => {
      const s = uniqueSuffix();
      await register(`dup-${s}`, `first-${s}@example.com`);
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          tenant_name: 'Dup',
          tenant_slug: `dup-${s}`,
          email: `second-${s}@example.com`,
          display_name: 'Second',
          password: 'Secret123!',
        },
      });
      expect(res.statusCode).toBe(409);
    });

    it('returns 400 on missing required fields', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { tenant_slug: 'x' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // ── Login ─────────────────────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('returns a JWT for valid credentials', async () => {
      const s = uniqueSuffix();
      await register(`login-${s}`, `user-${s}@example.com`);
      const { status, token } = await login(`login-${s}`, `user-${s}@example.com`);
      expect(status).toBe(200);
      expect(typeof token).toBe('string');
    });

    it('returns 401 for wrong password', async () => {
      const s = uniqueSuffix();
      await register(`wp-${s}`, `wp-${s}@example.com`);
      const { status } = await login(`wp-${s}`, `wp-${s}@example.com`, 'wrongpassword');
      expect(status).toBe(401);
    });

    it('returns 401 for unknown tenant slug', async () => {
      const { status } = await login('tenant-does-not-exist', 'nobody@example.com');
      expect(status).toBe(401);
    });

    it('returns 401 for wrong email within a valid tenant', async () => {
      const s = uniqueSuffix();
      await register(`we-${s}`, `real-${s}@example.com`);
      const { status } = await login(`we-${s}`, `ghost-${s}@example.com`);
      expect(status).toBe(401);
    });
  });

  // ── Users (tenant_admin) ──────────────────────────────────────────────────────

  describe('GET /users — tenant_admin', () => {
    it('lists users with role field present', async () => {
      const s = uniqueSuffix();
      const token = await register(`ul-${s}`, `admin-${s}@example.com`);
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ data: Record<string, unknown>[] }>();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBe(1);
      expect(body.data[0]).toMatchObject({
        email: `admin-${s}@example.com`,
        role: 'tenant_admin',
        status: 'active',
      });
      // Registration user is the first-tenant admin; no password fields exposed.
      expect(res.body).not.toContain('password');
      expect(res.body).not.toContain('hash');
    });

    it('returns 401 without auth', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/users' });
      expect(res.statusCode).toBe(401);
    });
  });

  // ── Create user (tenant_admin → tenant_operator) ──────────────────────────────

  describe('POST /users — tenant_admin creates tenant_operator', () => {
    it('creates a user with the correct role and returns 201', async () => {
      const s = uniqueSuffix();
      const adminToken = await register(`cu-${s}`, `admin-${s}@example.com`);
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          email: `operator-${s}@example.com`,
          display_name: 'Operator User',
          role: 'tenant_operator',
          password: 'OpPass123!',
        },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json<{ data: Record<string, unknown> }>();
      expect(body.data.role).toBe('tenant_operator');
      expect(body.data.email).toBe(`operator-${s}@example.com`);
      expect(res.body).not.toContain('password');
    });

    it('returns 409 on duplicate email within the same tenant', async () => {
      const s = uniqueSuffix();
      const adminToken = await register(`dup2-${s}`, `admin-${s}@example.com`);
      const payload = {
        email: `dup-user-${s}@example.com`,
        display_name: 'Dup',
        role: 'tenant_operator',
        password: 'OpPass123!',
      };
      const first = await app.inject({ method: 'POST', url: '/api/v1/users', headers: { authorization: `Bearer ${adminToken}` }, payload });
      expect(first.statusCode).toBe(201);
      const second = await app.inject({ method: 'POST', url: '/api/v1/users', headers: { authorization: `Bearer ${adminToken}` }, payload });
      expect(second.statusCode).toBe(409);
    });

    it('returns 400 for an invalid role value', async () => {
      const s = uniqueSuffix();
      const adminToken = await register(`ir-${s}`, `admin-${s}@example.com`);
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          email: `bad-${s}@example.com`,
          display_name: 'Bad Role',
          role: 'super_admin',
          password: 'OpPass123!',
        },
      });
      // Zod validation rejects the unknown role before the handler runs.
      expect(res.statusCode).toBe(400);
    });
  });

  // ── tenant_operator RBAC ──────────────────────────────────────────────────────

  describe('tenant_operator RBAC', () => {
    async function setupOperator(): Promise<{ adminToken: string; operatorToken: string; slug: string; s: string }> {
      const s = uniqueSuffix();
      const slug = `op-${s}`;
      const adminToken = await register(slug, `admin-${s}@example.com`);

      // tenant_admin creates an operator
      await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          email: `operator-${s}@example.com`,
          display_name: 'Operator',
          role: 'tenant_operator',
          password: 'OpPass123!',
        },
      });

      const { token: operatorToken } = await login(slug, `operator-${s}@example.com`, 'OpPass123!');
      return { adminToken, operatorToken: operatorToken!, slug, s };
    }

    it('operator can authenticate successfully', async () => {
      const { operatorToken } = await setupOperator();
      expect(typeof operatorToken).toBe('string');
      expect(operatorToken.length).toBeGreaterThan(10);
    });

    it('operator can list users (TENANT_USERS_VIEW allowed)', async () => {
      const { operatorToken } = await setupOperator();
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users',
        headers: { authorization: `Bearer ${operatorToken}` },
      });
      expect(res.statusCode).toBe(200);
    });

    it('operator cannot create users → 403 (TENANT_USERS_MANAGE denied)', async () => {
      const { operatorToken, s } = await setupOperator();
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/users',
        headers: { authorization: `Bearer ${operatorToken}` },
        payload: {
          email: `new-${s}@example.com`,
          display_name: 'New',
          role: 'tenant_viewer',
          password: 'Pass123!',
        },
      });
      expect(res.statusCode).toBe(403);
    });

    it('operator cannot update user roles → 403', async () => {
      const { adminToken, operatorToken } = await setupOperator();
      // Get the list to find a user ID to target
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/users',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const users = listRes.json<{ data: { id: string }[] }>().data;
      const targetId = users[0]!.id;

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/users/${targetId}`,
        headers: { authorization: `Bearer ${operatorToken}` },
        payload: { display_name: 'Hacked Name' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('operator cannot deactivate users → 403', async () => {
      const { adminToken, operatorToken } = await setupOperator();
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/users',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const users = listRes.json<{ data: { id: string }[] }>().data;
      const targetId = users[0]!.id;

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/users/${targetId}`,
        headers: { authorization: `Bearer ${operatorToken}` },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // ── Tenant isolation ──────────────────────────────────────────────────────────

  describe('tenant isolation', () => {
    it('tenant A token cannot see tenant B users', async () => {
      const sA = uniqueSuffix();
      const sB = uniqueSuffix();
      const tokenA = await register(`ti-a-${sA}`, `admin-a-${sA}@example.com`);
      await register(`ti-b-${sB}`, `admin-b-${sB}@example.com`);

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/users',
        headers: { authorization: `Bearer ${tokenA}` },
      });
      expect(res.statusCode).toBe(200);
      const users = res.json<{ data: { email: string }[] }>().data;
      // Only tenant A's own user should appear.
      expect(users.every((u) => u.email.includes(`-a-${sA}`))).toBe(true);
      expect(users.some((u) => u.email.includes(`-b-${sB}`))).toBe(false);
    });
  });
});
