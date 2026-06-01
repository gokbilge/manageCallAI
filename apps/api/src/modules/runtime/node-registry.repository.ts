import { randomBytes } from 'node:crypto';
import type { Pool } from 'pg';
import { encryptSipPassword, decryptSipPassword } from '../../crypto/sip-secret.js';
import type { CreateNodeInput, FreeSwitchNode, UpdateNodeInput } from './node-registry.types.js';

export class NodeRegistryRepository {
  constructor(private readonly db: Pool) {}

  async list(): Promise<FreeSwitchNode[]> {
    const r = await this.db.query<FreeSwitchNode>(
      `SELECT id, display_name, status, allowed_cidrs, capabilities, rate_limit_policy, created_at, updated_at
       FROM freeswitch_nodes
       WHERE status != 'decommissioned'
       ORDER BY display_name`,
    );
    return r.rows;
  }

  async findById(id: string): Promise<FreeSwitchNode | null> {
    const r = await this.db.query<FreeSwitchNode>(
      `SELECT id, display_name, status, allowed_cidrs, capabilities, rate_limit_policy, created_at, updated_at
       FROM freeswitch_nodes WHERE id = $1`,
      [id],
    );
    return r.rows[0] ?? null;
  }

  async create(input: CreateNodeInput): Promise<{ node: FreeSwitchNode; raw_token: string }> {
    const raw_token = randomBytes(32).toString('hex');
    const { ciphertext, keyId } = encryptSipPassword(raw_token);

    const r = await this.db.query<FreeSwitchNode>(
      `INSERT INTO freeswitch_nodes
         (display_name, token_encrypted, token_key_id, allowed_cidrs, capabilities, rate_limit_policy)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING id, display_name, status, allowed_cidrs, capabilities, rate_limit_policy, created_at, updated_at`,
      [
        input.display_name,
        ciphertext,
        keyId,
        input.allowed_cidrs ?? [],
        input.capabilities ?? ['dialplan', 'directory', 'event_ingest', 'outbound_poll'],
        JSON.stringify(input.rate_limit_policy ?? {}),
      ],
    );
    return { node: r.rows[0]!, raw_token };
  }

  async update(id: string, input: UpdateNodeInput): Promise<FreeSwitchNode | null> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [id];
    let idx = 2;

    if (input.display_name !== undefined) { setClauses.push(`display_name = $${idx++}`); values.push(input.display_name); }
    if (input.status !== undefined) { setClauses.push(`status = $${idx++}`); values.push(input.status); }
    if (input.allowed_cidrs !== undefined) { setClauses.push(`allowed_cidrs = $${idx++}`); values.push(input.allowed_cidrs); }
    if (input.capabilities !== undefined) { setClauses.push(`capabilities = $${idx++}`); values.push(input.capabilities); }
    if (input.rate_limit_policy !== undefined) { setClauses.push(`rate_limit_policy = $${idx++}::jsonb`); values.push(JSON.stringify(input.rate_limit_policy)); }

    const r = await this.db.query<FreeSwitchNode>(
      `UPDATE freeswitch_nodes
       SET ${setClauses.join(', ')}
       WHERE id = $1
       RETURNING id, display_name, status, allowed_cidrs, capabilities, rate_limit_policy, created_at, updated_at`,
      values,
    );
    return r.rows[0] ?? null;
  }

  async rotateToken(id: string): Promise<{ node: FreeSwitchNode; raw_token: string } | null> {
    const raw_token = randomBytes(32).toString('hex');
    const { ciphertext, keyId } = encryptSipPassword(raw_token);

    const r = await this.db.query<FreeSwitchNode>(
      `UPDATE freeswitch_nodes
       SET token_encrypted = $2, token_key_id = $3, updated_at = NOW()
       WHERE id = $1
       RETURNING id, display_name, status, allowed_cidrs, capabilities, rate_limit_policy, created_at, updated_at`,
      [id, ciphertext, keyId],
    );
    if (!r.rows[0]) return null;
    return { node: r.rows[0], raw_token };
  }

  async getDecryptedToken(nodeId: string): Promise<string | null> {
    const r = await this.db.query<{ token_encrypted: string; token_key_id: string }>(
      `SELECT token_encrypted, token_key_id
       FROM freeswitch_nodes WHERE id = $1 AND status = 'active'`,
      [nodeId],
    );
    if (!r.rows[0]) return null;
    try {
      return decryptSipPassword(r.rows[0].token_encrypted, r.rows[0].token_key_id);
    } catch {
      return null;
    }
  }

  // Returns true if nonce was freshly consumed; false if already seen (replay).
  async checkAndConsumeNonce(nodeId: string, nonce: string, windowMs = 600_000): Promise<boolean> {
    const expiresAt = new Date(Date.now() + windowMs).toISOString();
    try {
      await this.db.query(
        `INSERT INTO runtime_nonces (node_id, nonce, expires_at) VALUES ($1, $2, $3)`,
        [nodeId, nonce, expiresAt],
      );
      return true;
    } catch (err: unknown) {
      if (err instanceof Error && 'code' in err && (err as { code: string }).code === '23505') {
        return false; // PK violation = replayed nonce
      }
      throw err;
    }
  }

  async cleanExpiredNonces(): Promise<void> {
    await this.db.query(`DELETE FROM runtime_nonces WHERE expires_at < NOW()`);
  }
}
