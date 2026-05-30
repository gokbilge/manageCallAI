import { Pool } from 'pg';
import type {
  CreateSipTrunkRepoInput,
  SipTrunk,
  UpdateSipTrunkRepoInput,
} from './sip-trunk.types.js';

export class SipTrunkRepository {
  constructor(private readonly db: Pool) {}

  private readonly selectColumns = `
    st.id,
    st.tenant_id,
    st.name,
    st.direction,
    st.status,
    st.username,
    st.realm,
    st.proxy,
    st.port,
    st.transport,
    st.auth_username,
    st.dtmf_mode,
    st.codec_prefs,
    st.created_at,
    st.updated_at
  `;

  private readonly returningColumns = `
    id,
    tenant_id,
    name,
    direction,
    status,
    username,
    realm,
    proxy,
    port,
    transport,
    auth_username,
    dtmf_mode,
    codec_prefs,
    created_at,
    updated_at
  `;

  async findAllByTenant(tenantId: string): Promise<SipTrunk[]> {
    const result = await this.db.query<SipTrunk>(
      `SELECT ${this.selectColumns}
       FROM sip_trunks st
       WHERE st.tenant_id = $1
       ORDER BY st.name ASC`,
      [tenantId],
    );
    return result.rows;
  }

  async findById(id: string, tenantId: string): Promise<SipTrunk | null> {
    const result = await this.db.query<SipTrunk>(
      `SELECT ${this.selectColumns}
       FROM sip_trunks st
       WHERE st.id = $1 AND st.tenant_id = $2`,
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async create(input: CreateSipTrunkRepoInput): Promise<SipTrunk> {
    const result = await this.db.query<SipTrunk>(
      `INSERT INTO sip_trunks
         (tenant_id, name, direction, username, realm, proxy, port, transport,
          auth_username, auth_password_ciphertext, auth_password_key_id,
          dtmf_mode, codec_prefs)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING ${this.returningColumns}`,
      [
        input.tenant_id,
        input.name,
        input.direction,
        input.username ?? null,
        input.realm,
        input.proxy,
        input.port ?? 5060,
        input.transport ?? 'udp',
        input.auth_username,
        input.auth_password_ciphertext,
        input.auth_password_key_id,
        input.dtmf_mode ?? 'rfc2833',
        input.codec_prefs ?? null,
      ],
    );
    return result.rows[0]!;
  }

  async update(id: string, tenantId: string, input: UpdateSipTrunkRepoInput): Promise<SipTrunk | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const updateable = [
      'name',
      'direction',
      'status',
      'username',
      'realm',
      'proxy',
      'port',
      'transport',
      'auth_username',
      'auth_password_ciphertext',
      'auth_password_key_id',
      'dtmf_mode',
      'codec_prefs',
    ] as const;

    for (const col of updateable) {
      if (col in input) {
        fields.push(`${col} = $${idx++}`);
        values.push(input[col] ?? null);
      }
    }

    if (fields.length === 0) {
      return this.findById(id, tenantId);
    }

    fields.push('updated_at = NOW()');
    values.push(id, tenantId);

    const result = await this.db.query<SipTrunk>(
      `UPDATE sip_trunks
       SET ${fields.join(', ')}
       WHERE id = $${idx} AND tenant_id = $${idx + 1}
       RETURNING ${this.returningColumns}`,
      values,
    );
    return result.rows[0] ?? null;
  }

  async deactivate(id: string, tenantId: string): Promise<SipTrunk | null> {
    const result = await this.db.query<SipTrunk>(
      `UPDATE sip_trunks
       SET status = 'inactive', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING ${this.returningColumns}`,
      [id, tenantId],
    );
    return result.rows[0] ?? null;
  }
}
