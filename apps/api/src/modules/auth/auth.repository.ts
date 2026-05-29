import { Pool } from 'pg';

interface UserRow {
  id: string;
  tenant_id: string;
  email: string;
  display_name: string;
  status: string;
  password_hash: string;
  role: string;
}

interface CreateTenantAndUserInput {
  tenant_name: string;
  tenant_slug: string;
  email: string;
  display_name: string;
  password_hash: string;
}

interface CreatedUser {
  id: string;
  tenant_id: string;
  email: string;
}

export class AuthRepository {
  constructor(private readonly db: Pool) {}

  async findUserByEmailAndSlug(email: string, tenantSlug: string): Promise<UserRow | null> {
    const result = await this.db.query<UserRow>(
      `SELECT u.id, u.tenant_id, u.email, u.display_name, u.status, u.password_hash, u.role
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.email = $1 AND t.slug = $2`,
      [email, tenantSlug],
    );
    return result.rows[0] ?? null;
  }

  async createTenantAndUser(input: CreateTenantAndUserInput): Promise<CreatedUser> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      const tenantResult = await client.query<{ id: string }>(
        `INSERT INTO tenants (name, slug, directory_domain) VALUES ($1, $2, $3) RETURNING id`,
        [input.tenant_name, input.tenant_slug, `${input.tenant_slug}.managecallai.local`],
      );
      const tenantId = tenantResult.rows[0]!.id;

      const userResult = await client.query<CreatedUser>(
        `INSERT INTO users (tenant_id, email, display_name, password_hash)
         VALUES ($1, $2, $3, $4)
         RETURNING id, tenant_id, email`,
        [tenantId, input.email, input.display_name, input.password_hash],
      );

      await client.query('COMMIT');
      return userResult.rows[0]!;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async touchLastLogin(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [userId],
    );
  }
}
