import type { Pool } from 'pg';
import { decryptSipPassword } from '../../crypto/sip-secret.js';
import type { TrunkGateway } from './freeswitch.controller.js';

type TrunkRow = {
  id: string;
  name: string;
  direction: 'inbound' | 'outbound' | 'bidirectional';
  realm: string;
  proxy: string;
  port: number;
  transport: 'udp' | 'tcp' | 'tls';
  auth_username: string;
  auth_password_ciphertext: string;
  auth_password_key_id: string;
  dtmf_mode: 'rfc2833' | 'info' | 'inband' | 'auto';
};

export class GatewayRepository {
  constructor(private readonly db: Pool) {}

  async findAllActiveTrunks(): Promise<TrunkGateway[]> {
    const result = await this.db.query<TrunkRow>(
      `SELECT id, name, direction, realm, proxy, port, transport,
              auth_username, auth_password_ciphertext, auth_password_key_id,
              dtmf_mode
       FROM sip_trunks
       WHERE status = 'active'
       ORDER BY name ASC`,
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      direction: row.direction,
      realm: row.realm,
      proxy: row.proxy,
      port: row.port,
      transport: row.transport,
      auth_username: row.auth_username,
      auth_password: decryptSipPassword(row.auth_password_ciphertext, row.auth_password_key_id),
      dtmf_mode: row.dtmf_mode,
    }));
  }
}
