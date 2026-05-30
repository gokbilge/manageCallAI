/**
 * Auth / RBAC integration tests.
 *
 * Tests the full HTTP stack — Fastify, JWT plugin, requireCapability(), DB — to
 * verify that capability enforcement, tenant isolation, and JWT security all
 * behave correctly end-to-end.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';

// ── Setup ─────────────────────────────────────────────────────────────────────

let app: FastifyInstance;
let db: Pool;

type RegisterInput = {
  tenant_name: string;
  tenant_slug: string;
  email: string;
  display_name: string;
  password: string;
};

type TokenResult = { token: string; tenant_id: string; user_id: string };

async function register(input: RegisterInput): Promise<TokenResult> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: input,
  });
  expect(res.statusCode, `register failed: ${res.body}`).toBe(201);
  const { token } = res.json<{ token: string }>();

  // Decode the payload (not verifying — test env knows the secret)
  const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString());
  return { token, tenant_id: payload.tenant_id as string, user_id: payload.sub as string };
}

async function login(slug: string, email: string, password: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { tenant_slug: slug, email, password },
  });
  expect(res.statusCode, `login failed: ${res.body}`).toBe(200);
  return res.json<{ token: string }>().token;
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function randomSlug() {
  return `t-${randomUUID().slice(0, 8)}`;
}

beforeAll(async () => {
  process.env['RUNTIME_API_TOKEN'] ??= 'test-runtime-token';
  process.env['JWT_SECRET'] ??= 'test-jwt-secret';
  process.env['SIP_SECRET_MASTER_KEY'] ??= '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  process.env['SIP_SECRET_KEY_ID'] ??= 'v1';

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

// ── Auth endpoints ────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/register', () => {
  it('creates a tenant+user and returns a JWT', async () => {
    const slug = randomSlug();
    const result = await register({ tenant_name: 'Acme', tenant_slug: slug, email: `admin@${slug}.com`, display_name: 'Admin', password: 'Secret123!' });
    expect(result.token).toBeTruthy();
    expect(result.tenant_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('returns 409 when slug already exists', async () => {
    const slug = randomSlug();
    await register({ tenant_name: 'A', tenant_slug: slug, email: `a@${slug}.com`, display_name: 'A', password: 'Secret123!' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { tenant_name: 'B', tenant_slug: slug, email: `b@${slug}.com`, display_name: 'B', password: 'Secret123!' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('returns 429 after 5 registration attempts in 1 minute', async () => {
    const responses: number[] = [];
    for (let i = 0; i < 7; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { tenant_name: `T${i}`, tenant_slug: `ratelimit-${randomUUID().slice(0, 6)}`, email: `r${i}@test.com`, display_name: 'R', password: 'Secret123!' },
      });
      responses.push(res.statusCode);
    }
    expect(responses).toContain(429);
  });
});

describe('POST /api/v1/auth/login', () => {
  it('returns a JWT on valid credentials', async () => {
    const slug = randomSlug();
    await register({ tenant_name: 'L', tenant_slug: slug, email: `l@${slug}.com`, display_name: 'L', password: 'Pass123!' });
    const token = await login(slug, `l@${slug}.com`, 'Pass123!');
    expect(token).toBeTruthy();
  });

  it('returns 401 for wrong password', async () => {
    const slug = randomSlug();
    await register({ tenant_name: 'W', tenant_slug: slug, email: `w@${slug}.com`, display_name: 'W', password: 'Pass123!' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { tenant_slug: slug, email: `w@${slug}.com`, password: 'WrongPass!' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 for unknown email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { tenant_slug: 'nonexistent', email: 'nobody@test.com', password: 'Pass123!' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 429 after 10 attempts in 1 minute', async () => {
    const slug = randomSlug();
    const responses: number[] = [];
    for (let i = 0; i < 13; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { tenant_slug: slug, email: `brute@test.com`, password: `Wrong${i}` },
      });
      responses.push(res.statusCode);
    }
    expect(responses).toContain(429);
  });
});

// ── Capability enforcement by role ────────────────────────────────────────────

describe('RBAC — tenant_viewer capabilities', () => {
  let viewerToken: string;

  beforeEach(async () => {
    const slug = randomSlug();
    const { token: adminToken, tenant_id } = await register({ tenant_name: 'V', tenant_slug: slug, email: `admin@${slug}.com`, display_name: 'Admin', password: 'Admin123!' });

    // Create a viewer user via the admin
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: authHeader(adminToken),
      payload: { email: `viewer@${slug}.com`, display_name: 'Viewer', role: 'tenant_viewer', password: 'Viewer123!' },
    });
    expect(createRes.statusCode).toBe(201);

    viewerToken = await login(slug, `viewer@${slug}.com`, 'Viewer123!');
    void tenant_id;
  });

  it('can list extensions (read)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/extensions', headers: authHeader(viewerToken) });
    expect(res.statusCode).toBe(200);
  });

  it('cannot create an extension', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/extensions',
      headers: authHeader(viewerToken),
      payload: { extension_number: '9001', display_name: 'X', sip_password: 'Secure123!' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('cannot manage users', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/users', headers: authHeader(viewerToken) });
    expect(res.statusCode).toBe(403);
  });

  it('cannot manage API keys', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/automation/keys', headers: authHeader(viewerToken) });
    expect(res.statusCode).toBe(403);
  });
});

describe('RBAC — tenant_operator capabilities', () => {
  let operatorToken: string;
  let slug: string;

  beforeEach(async () => {
    slug = randomSlug();
    const { token: adminToken } = await register({ tenant_name: 'Op', tenant_slug: slug, email: `admin@${slug}.com`, display_name: 'Admin', password: 'Admin123!' });
    await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: authHeader(adminToken),
      payload: { email: `op@${slug}.com`, display_name: 'Op', role: 'tenant_operator', password: 'Op123456!' },
    });
    operatorToken = await login(slug, `op@${slug}.com`, 'Op123456!');
  });

  it('can create an extension', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/extensions',
      headers: authHeader(operatorToken),
      payload: { extension_number: '7001', display_name: 'X', sip_password: 'Secure123!' },
    });
    expect(res.statusCode).toBe(201);
  });

  it('cannot publish an IVR flow', async () => {
    // Create a flow first
    const flowRes = await app.inject({
      method: 'POST',
      url: '/api/v1/ivr-flows',
      headers: authHeader(operatorToken),
      payload: { name: 'Test Flow' },
    });
    expect(flowRes.statusCode).toBe(201);
    const { data: flow } = flowRes.json<{ data: { id: string; draft_version_id: string } }>();

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/ivr-flows/${flow.id}/versions/${flow.draft_version_id}/publish`,
      headers: authHeader(operatorToken),
    });
    expect(res.statusCode).toBe(403);
  });

  it('cannot manage users', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/users',
      headers: authHeader(operatorToken),
      payload: { email: `new@${slug}.com`, display_name: 'New', role: 'tenant_viewer', password: 'Pass123!' },
    });
    expect(res.statusCode).toBe(403);
  });
});

// ── Tenant isolation ──────────────────────────────────────────────────────────

describe('tenant isolation', () => {
  let tokenA: string;
  let tokenB: string;
  let extensionIdA: string;
  let slugA: string;
  let slugB: string;

  beforeEach(async () => {
    slugA = randomSlug();
    slugB = randomSlug();
    const a = await register({ tenant_name: 'TenantA', tenant_slug: slugA, email: `a@${slugA}.com`, display_name: 'A', password: 'PassA123!' });
    const b = await register({ tenant_name: 'TenantB', tenant_slug: slugB, email: `b@${slugB}.com`, display_name: 'B', password: 'PassB123!' });
    tokenA = a.token;
    tokenB = b.token;

    // Create an extension in Tenant A
    const extRes = await app.inject({
      method: 'POST',
      url: '/api/v1/extensions',
      headers: authHeader(tokenA),
      payload: { extension_number: '8001', display_name: 'A Ext', sip_password: 'Secure123!' },
    });
    expect(extRes.statusCode).toBe(201);
    extensionIdA = extRes.json<{ data: { id: string } }>().data.id;
  });

  it('Tenant B cannot read Tenant A extension by ID', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/extensions/${extensionIdA}`,
      headers: authHeader(tokenB),
    });
    expect(res.statusCode).toBe(404);
  });

  it('Tenant B extension list does not contain Tenant A extensions', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/extensions',
      headers: authHeader(tokenB),
    });
    expect(res.statusCode).toBe(200);
    const { data } = res.json<{ data: Array<{ id: string }> }>();
    expect(data.map((e) => e.id)).not.toContain(extensionIdA);
  });

  it('Tenant B cannot update Tenant A extension', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/extensions/${extensionIdA}`,
      headers: authHeader(tokenB),
      payload: { display_name: 'Hacked' },
    });
    expect(res.statusCode).toBe(404);
  });
});

// ── JWT security ──────────────────────────────────────────────────────────────

describe('JWT security', () => {
  it('returns 401 for a missing Authorization header', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/extensions' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 for an expired JWT', async () => {
    const slug = randomSlug();
    await register({ tenant_name: 'E', tenant_slug: slug, email: `e@${slug}.com`, display_name: 'E', password: 'Pass123!' });
    // Issue a token with 1ms TTL by accessing the JWT sign directly
    const { buildApp } = await import('../../app.js');
    const tmpApp = buildApp();
    await tmpApp.ready();
    const expiredToken = tmpApp.jwt.sign({ sub: randomUUID(), tenant_id: randomUUID(), email: 'x@x.com', role: 'tenant_admin' }, { expiresIn: '1ms' });
    await tmpApp.close();

    await new Promise((r) => setTimeout(r, 10));
    const res = await app.inject({ method: 'GET', url: '/api/v1/extensions', headers: authHeader(expiredToken) });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 for a token signed with a different secret', async () => {
    // Manually craft a JWT with the wrong signing secret
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: randomUUID(), tenant_id: randomUUID(), email: 'x@x.com', role: 'tenant_admin', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
    const badToken = `${header}.${payload}.invalidsignature`;

    const res = await app.inject({ method: 'GET', url: '/api/v1/extensions', headers: authHeader(badToken) });
    expect(res.statusCode).toBe(401);
  });
});
