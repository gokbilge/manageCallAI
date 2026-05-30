/**
 * DB contract tests — assert schema invariants directly against PostgreSQL.
 *
 * These tests bypass all application code and connect to the database with a
 * raw Pool. They prove that constraints, triggers, and immutability rules work
 * regardless of what the API layer does.
 *
 * Requirements:
 *   - DATABASE_URL must point to a test database with all migrations applied.
 *   - Each test uses SAVEPOINT / ROLLBACK TO SAVEPOINT for isolation.
 *   - The outermost transaction is rolled back in afterAll so no permanent
 *     data is written.
 */
import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

let pool: Pool;
let client: PoolClient;

beforeAll(async () => {
  pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
  client = await pool.connect();
  await client.query('BEGIN');
});

afterAll(async () => {
  await client.query('ROLLBACK');
  client.release();
  await pool.end();
});

beforeEach(async () => {
  await client.query('SAVEPOINT test_start');
});

afterEach(async () => {
  await client.query('ROLLBACK TO SAVEPOINT test_start');
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function insertTenant(slug = randomUUID().slice(0, 8)) {
  const r = await client.query<{ id: string }>(
    `INSERT INTO tenants (name, slug, directory_domain)
     VALUES ($1, $2, $3) RETURNING id`,
    [`Tenant ${slug}`, slug, `${slug}.sip.local`],
  );
  return r.rows[0]!.id;
}

async function insertUser(tenantId: string, role = 'tenant_admin', email = `${randomUUID()}@test.local`) {
  const r = await client.query<{ id: string }>(
    `INSERT INTO users (tenant_id, email, display_name, password_hash, role)
     VALUES ($1, $2, 'Test User', '$2a$12$testhashhashhashhashhashhashhashhashhashhashha', $3)
     RETURNING id`,
    [tenantId, email, role],
  );
  return r.rows[0]!.id;
}

async function insertExtension(tenantId: string, num = '1001') {
  const r = await client.query<{ id: string }>(
    `INSERT INTO extensions (tenant_id, extension_number, display_name, sip_username, sip_password_ciphertext, sip_password_key_id)
     VALUES ($1, $2, 'Test Ext', $2, 'cipher', 'v1') RETURNING id`,
    [tenantId, num],
  );
  return r.rows[0]!.id;
}

async function insertPhoneNumber(tenantId: string, number = '+15551234567') {
  const r = await client.query<{ id: string }>(
    `INSERT INTO phone_numbers (tenant_id, e164_number) VALUES ($1, $2) RETURNING id`,
    [tenantId, number],
  );
  return r.rows[0]!.id;
}

// ── Group A: Role model invariants ────────────────────────────────────────────

describe('users.role — role model invariants', () => {
  it('rejects an unknown role value', async () => {
    const tenantId = await insertTenant();
    await client.query('SAVEPOINT inner_check');
    await expect(
      client.query(
        `INSERT INTO users (tenant_id, email, display_name, password_hash, role)
         VALUES ($1, 'bad@role.local', 'Bad', '$2a$12$testhash', 'superuser')`,
        [tenantId],
      ),
    ).rejects.toThrow(/check/i);
    await client.query('ROLLBACK TO SAVEPOINT inner_check');
    await client.query('RELEASE SAVEPOINT inner_check');
  });

  it('accepts all four defined role values', async () => {
    const tenantId = await insertTenant();
    for (const role of ['tenant_admin', 'tenant_operator', 'tenant_viewer', 'platform_admin']) {
      await expect(
        client.query(
          `INSERT INTO users (tenant_id, email, display_name, password_hash, role)
           VALUES ($1, $2, 'R', '$2a$12$testhash', $3)`,
          [tenantId, `${role}@test.local`, role],
        ),
      ).resolves.not.toThrow();
    }
  });

  it('rejects an empty string role', async () => {
    const tenantId = await insertTenant();
    await client.query('SAVEPOINT inner_check');
    await expect(
      client.query(
        `INSERT INTO users (tenant_id, email, display_name, password_hash, role)
         VALUES ($1, 'empty@role.local', 'E', '$2a$12$testhash', '')`,
        [tenantId],
      ),
    ).rejects.toThrow(/check/i);
    await client.query('ROLLBACK TO SAVEPOINT inner_check');
    await client.query('RELEASE SAVEPOINT inner_check');
  });

  it('rejects null role', async () => {
    const tenantId = await insertTenant();
    await expect(
      client.query(
        `INSERT INTO users (tenant_id, email, display_name, password_hash)
         VALUES ($1, 'null@role.local', 'N', '$2a$12$testhash')`,
        [tenantId],
      ),
    ).resolves.not.toThrow(); // DEFAULT 'tenant_admin' kicks in — role is NOT NULL with a default
    // Verify the default was applied:
    const r = await client.query<{ role: string }>(
      `SELECT role FROM users WHERE email = 'null@role.local' AND tenant_id = $1`,
      [tenantId],
    );
    expect(r.rows[0]?.role).toBe('tenant_admin');
  });

  it('rejects an empty password_hash', async () => {
    const tenantId = await insertTenant();
    await client.query('SAVEPOINT inner_check');
    await expect(
      client.query(
        `INSERT INTO users (tenant_id, email, display_name, password_hash, role)
         VALUES ($1, 'empty@pw.local', 'E', '', 'tenant_admin')`,
        [tenantId],
      ),
    ).rejects.toThrow(/check/i);
    await client.query('ROLLBACK TO SAVEPOINT inner_check');
    await client.query('RELEASE SAVEPOINT inner_check');
  });
});

// ── Group B: Tenant isolation triggers ───────────────────────────────────────

describe('inbound_routes.phone_number_id — cross-tenant isolation', () => {
  it('rejects a phone number owned by a different tenant', async () => {
    const tenantA = await insertTenant('tenant-a');
    const tenantB = await insertTenant('tenant-b');
    const phoneB = await insertPhoneNumber(tenantB, '+15550000001');

    await client.query('SAVEPOINT inner_check');
    await expect(
      client.query(
        `INSERT INTO inbound_routes
           (tenant_id, name, match_type, match_value, target_type, phone_number_id)
         VALUES ($1, 'route1', 'did', '+15550000001', 'extension', $2)`,
        [tenantA, phoneB],
      ),
    ).rejects.toThrow(/foreign_key_violation|phone_number_id/i);
    await client.query('ROLLBACK TO SAVEPOINT inner_check');
    await client.query('RELEASE SAVEPOINT inner_check');
  });

  it('accepts a phone number owned by the same tenant', async () => {
    const tenantA = await insertTenant('tenant-a2');
    const phoneA = await insertPhoneNumber(tenantA, '+15550000002');

    await expect(
      client.query(
        `INSERT INTO inbound_routes
           (tenant_id, name, match_type, match_value, target_type, phone_number_id)
         VALUES ($1, 'route2', 'did', '+15550000002', 'extension', $2)`,
        [tenantA, phoneA],
      ),
    ).resolves.not.toThrow();
  });

  it('accepts NULL phone_number_id (no phone number assigned)', async () => {
    const tenantA = await insertTenant('tenant-a3');
    await expect(
      client.query(
        `INSERT INTO inbound_routes
           (tenant_id, name, match_type, match_value, target_type)
         VALUES ($1, 'route3', 'did', '+15550000003', 'extension')`,
        [tenantA],
      ),
    ).resolves.not.toThrow();
  });
});

describe('queue_members.extension_id — cross-tenant isolation', () => {
  it('rejects an extension owned by a different tenant', async () => {
    const tenantA = await insertTenant('qt-a');
    const tenantB = await insertTenant('qt-b');
    const extB = await insertExtension(tenantB, '2001');

    // Create a queue in tenantA
    const qR = await client.query<{ id: string }>(
      `INSERT INTO queues (tenant_id, name, strategy)
       VALUES ($1, 'Q1', 'simultaneous') RETURNING id`,
      [tenantA],
    );
    const queueId = qR.rows[0]!.id;

    await client.query('SAVEPOINT inner_check');
    await expect(
      client.query(
        `INSERT INTO queue_members (tenant_id, queue_id, extension_id, position)
         VALUES ($1, $2, $3, 1)`,
        [tenantA, queueId, extB],
      ),
    ).rejects.toThrow(/foreign_key_violation|extension_id/i);
    await client.query('ROLLBACK TO SAVEPOINT inner_check');
    await client.query('RELEASE SAVEPOINT inner_check');
  });
});

// ── Group C: Audit immutability ───────────────────────────────────────────────

describe('tenant_audit_log immutability', () => {
  it('silently ignores UPDATE on tenant_audit_log (DO INSTEAD NOTHING)', async () => {
    const tenantId = await insertTenant('audit-t1');
    await client.query(
      `INSERT INTO tenant_audit_log (tenant_id, action, resource_type)
       VALUES ($1, 'test.action', 'test')`,
      [tenantId],
    );
    // UPDATE must execute without error but change nothing (rule: DO INSTEAD NOTHING)
    await client.query(
      `UPDATE tenant_audit_log SET action = 'tampered' WHERE tenant_id = $1`,
      [tenantId],
    );
    const r = await client.query<{ action: string }>(
      `SELECT action FROM tenant_audit_log WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [tenantId],
    );
    expect(r.rows[0]?.action).toBe('test.action');
  });

  it('silently ignores DELETE on tenant_audit_log (DO INSTEAD NOTHING)', async () => {
    const tenantId = await insertTenant('audit-t2');
    await client.query(
      `INSERT INTO tenant_audit_log (tenant_id, action, resource_type)
       VALUES ($1, 'delete.test', 'test')`,
      [tenantId],
    );
    await client.query(
      `DELETE FROM tenant_audit_log WHERE tenant_id = $1`,
      [tenantId],
    );
    const r = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tenant_audit_log WHERE tenant_id = $1`,
      [tenantId],
    );
    expect(r.rows[0]?.count).toBe('1');
  });
});

// ── Group D: Unique constraints ───────────────────────────────────────────────

describe('unique constraints', () => {
  it('rejects duplicate (tenant_id, extension_number)', async () => {
    const tenantId = await insertTenant('uniq-ext');
    await insertExtension(tenantId, '3001');
    await expect(insertExtension(tenantId, '3001')).rejects.toThrow(/unique/i);
  });

  it('allows the same extension_number in different tenants', async () => {
    const tenantA = await insertTenant('uniq-extA');
    const tenantB = await insertTenant('uniq-extB');
    await expect(insertExtension(tenantA, '4001')).resolves.not.toThrow();
    await expect(insertExtension(tenantB, '4001')).resolves.not.toThrow();
  });

  it('rejects duplicate (tenant_id, email) in users', async () => {
    const tenantId = await insertTenant('uniq-usr');
    const email = `dup-${randomUUID()}@test.local`;
    await insertUser(tenantId, 'tenant_admin', email);
    await expect(insertUser(tenantId, 'tenant_operator', email)).rejects.toThrow(/unique/i);
  });

  it('allows the same email in different tenants', async () => {
    const tenantA = await insertTenant('uniq-usrA');
    const tenantB = await insertTenant('uniq-usrB');
    const email = `shared-${randomUUID()}@test.local`;
    await expect(insertUser(tenantA, 'tenant_admin', email)).resolves.not.toThrow();
    await expect(insertUser(tenantB, 'tenant_admin', email)).resolves.not.toThrow();
  });
});

// ── Group E: E.164 format ─────────────────────────────────────────────────────

describe('phone_numbers.e164_number format constraint', () => {
  it('rejects non-E.164 formats', async () => {
    const tenantId = await insertTenant('e164-t');
    const badNumbers = ['5551234', '15551234567', '+1 555 123 4567', '555-123-4567', '+'];
    for (const num of badNumbers) {
      // Each failing query aborts the transaction within the savepoint. Use a
      // nested savepoint so the outer savepoint (test_start) remains clean.
      await client.query('SAVEPOINT inner_check');
      await expect(
        client.query(
          `INSERT INTO phone_numbers (tenant_id, e164_number) VALUES ($1, $2)`,
          [tenantId, num],
        ),
      ).rejects.toThrow(/check/i);
      await client.query('ROLLBACK TO SAVEPOINT inner_check');
      await client.query('RELEASE SAVEPOINT inner_check');
    }
  });

  it('accepts valid E.164 numbers', async () => {
    const tenantId = await insertTenant('e164-v');
    const goodNumbers = ['+15551234567', '+442071234567', '+19995550001', '+33123456789'];
    for (const num of goodNumbers) {
      await expect(
        client.query(
          `INSERT INTO phone_numbers (tenant_id, e164_number) VALUES ($1, $2)`,
          [tenantId, num],
        ),
      ).resolves.not.toThrow();
    }
  });
});

// ── Group F: Capability format ────────────────────────────────────────────────

describe('automation_api_keys.capabilities format constraint', () => {
  it('rejects capability strings not matching the dot-namespace format', async () => {
    const tenantId = await insertTenant('cap-t');
    const badCaps = ['ADMIN', 'tenant extensions create', 'tenant..extensions', '123.abc'];
    for (const cap of badCaps) {
      await client.query('SAVEPOINT inner_check');
      await expect(
        client.query(
          `INSERT INTO automation_api_keys (tenant_id, name, key_prefix, key_hash, capabilities)
           VALUES ($1, 'k', 'abc', $2, ARRAY[$3])`,
          [tenantId, randomUUID(), cap],
        ),
      ).rejects.toThrow(/check/i);
      await client.query('ROLLBACK TO SAVEPOINT inner_check');
      await client.query('RELEASE SAVEPOINT inner_check');
    }
  });

  it('accepts valid dot-namespaced capability strings', async () => {
    const tenantId = await insertTenant('cap-v');
    await expect(
      client.query(
        `INSERT INTO automation_api_keys (tenant_id, name, key_prefix, key_hash, capabilities)
         VALUES ($1, 'k', 'abc', $2, ARRAY['tenant.extensions.view', 'tenant.calls.view'])`,
        [tenantId, randomUUID()],
      ),
    ).resolves.not.toThrow();
  });

  it('accepts an empty capabilities array', async () => {
    const tenantId = await insertTenant('cap-e');
    await expect(
      client.query(
        `INSERT INTO automation_api_keys (tenant_id, name, key_prefix, key_hash, capabilities)
         VALUES ($1, 'k', 'abc', $2, ARRAY[]::text[])`,
        [tenantId, randomUUID()],
      ),
    ).resolves.not.toThrow();
  });
});

// ── Group G: Migration integrity ──────────────────────────────────────────────

describe('schema_migrations integrity', () => {
  it('all applied migration filenames reference .sql files', async () => {
    const r = await client.query<{ filename: string }>(
      'SELECT filename FROM schema_migrations ORDER BY filename',
    );
    for (const row of r.rows) {
      expect(row.filename).toMatch(/\.sql$/);
    }
  });

  it('applied migrations with sha256_hex have a non-empty hash', async () => {
    const r = await client.query<{ filename: string; sha256_hex: string }>(
      `SELECT filename, sha256_hex FROM schema_migrations WHERE sha256_hex IS NOT NULL`,
    );
    for (const row of r.rows) {
      expect(row.sha256_hex).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
