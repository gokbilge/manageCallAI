import type { Pool } from 'pg';
import type { TenantSummary } from './platform.types.js';

export class PlatformRepository {
  constructor(private readonly db: Pool) {}

  async listTenants(): Promise<TenantSummary[]> {
    const result = await this.db.query<TenantSummary>(
      `SELECT id, name, slug, directory_domain, status, created_at, updated_at
       FROM tenants
       ORDER BY created_at DESC`,
    );
    return result.rows;
  }
}
