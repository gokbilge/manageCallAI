import type { Pool } from 'pg';
import type { CreateUserInput, TenantUser, UpdateUserInput } from './user.types.js';

export class UserRepository {
  constructor(private readonly db: Pool) {}

  async listByTenant(tenantId: string): Promise<TenantUser[]> {
    const result = await this.db.query<TenantUser>(
      `SELECT id, tenant_id, email, display_name, role, status, last_login_at, created_at, updated_at
       FROM users
       WHERE tenant_id = $1
       ORDER BY created_at ASC`,
      [tenantId],
    );
    return result.rows;
  }

  async findById(id: string, tenantId: string): Promise<TenantUser | null> {
    const result = await this.db.query<TenantUser>(
      `SELECT id, tenant_id, email, display_name, role, status, last_login_at, created_at, updated_at
       FROM users
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async create(input: CreateUserInput): Promise<TenantUser> {
    const result = await this.db.query<TenantUser>(
      `INSERT INTO users (tenant_id, email, display_name, role, password_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, tenant_id, email, display_name, role, status, last_login_at, created_at, updated_at`,
      [input.tenant_id, input.email, input.display_name, input.role, input.password_hash],
    );
    return result.rows[0]!;
  }

  async update(id: string, tenantId: string, input: UpdateUserInput): Promise<TenantUser | null> {
    const sets: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let idx = 1;

    if (input.display_name !== undefined) {
      sets.push(`display_name = $${idx++}`);
      values.push(input.display_name);
    }
    if (input.role !== undefined) {
      sets.push(`role = $${idx++}`);
      values.push(input.role);
    }

    values.push(id, tenantId);
    const result = await this.db.query<TenantUser>(
      `UPDATE users SET ${sets.join(', ')}
       WHERE id = $${idx++} AND tenant_id = $${idx}
       RETURNING id, tenant_id, email, display_name, role, status, last_login_at, created_at, updated_at`,
      values,
    );
    return result.rows[0] ?? null;
  }

  async deactivate(id: string, tenantId: string): Promise<TenantUser | null> {
    const result = await this.db.query<TenantUser>(
      `UPDATE users SET status = 'inactive', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, tenant_id, email, display_name, role, status, last_login_at, created_at, updated_at`,
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }
}
