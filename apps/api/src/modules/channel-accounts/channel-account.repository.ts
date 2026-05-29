import type { Pool } from 'pg';
import type { ChannelAccount, CreateChannelAccountInput, UpdateChannelAccountInput } from './channel-account.types.js';

const COLUMNS = `id, tenant_id, provider_type, name, status, capabilities, provider_config, created_at, updated_at`;

export class ChannelAccountRepository {
  constructor(private readonly db: Pool) {}

  async create(input: CreateChannelAccountInput): Promise<ChannelAccount> {
    const r = await this.db.query<ChannelAccount>(
      `INSERT INTO channel_accounts (tenant_id, provider_type, name, capabilities, provider_config)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${COLUMNS}`,
      [
        input.tenant_id,
        input.provider_type,
        input.name,
        input.capabilities ?? [],
        JSON.stringify(input.provider_config ?? {}),
      ],
    );
    return r.rows[0]!;
  }

  async findById(id: string, tenantId: string): Promise<ChannelAccount | null> {
    const r = await this.db.query<ChannelAccount>(
      `SELECT ${COLUMNS} FROM channel_accounts WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async findByTenant(tenantId: string): Promise<ChannelAccount[]> {
    const r = await this.db.query<ChannelAccount>(
      `SELECT ${COLUMNS} FROM channel_accounts WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return r.rows;
  }

  async update(id: string, tenantId: string, input: UpdateChannelAccountInput): Promise<ChannelAccount | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    if (input.name !== undefined) { sets.push(`name = $${i++}`); params.push(input.name); }
    if (input.capabilities !== undefined) { sets.push(`capabilities = $${i++}`); params.push(input.capabilities); }
    if (input.provider_config !== undefined) { sets.push(`provider_config = $${i++}`); params.push(JSON.stringify(input.provider_config)); }
    sets.push(`updated_at = NOW()`);
    params.push(id, tenantId);
    const r = await this.db.query<ChannelAccount>(
      `UPDATE channel_accounts SET ${sets.join(', ')}
       WHERE id = $${i++} AND tenant_id = $${i}
       RETURNING ${COLUMNS}`,
      params,
    );
    return r.rows[0] ?? null;
  }

  async deactivate(id: string, tenantId: string): Promise<ChannelAccount | null> {
    const r = await this.db.query<ChannelAccount>(
      `UPDATE channel_accounts SET status = 'inactive', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2 AND status = 'active'
       RETURNING ${COLUMNS}`,
      [id, tenantId],
    );
    return r.rows[0] ?? null;
  }
}
