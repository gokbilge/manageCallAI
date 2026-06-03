import type { Pool } from 'pg';
import type { NodeStatusSnapshot, UpsertNodeStatusInput } from './node-status.types.js';

const COLS = `
  node_id, queried_at, freeswitch_version, loaded_modules,
  missing_required_modules, sofia_profiles, gateway_statuses,
  active_channel_count, active_registration_count
`;

export class NodeStatusRepository {
  constructor(private readonly db: Pool) {}

  async upsert(input: UpsertNodeStatusInput): Promise<NodeStatusSnapshot> {
    const r = await this.db.query<NodeStatusSnapshot>(
      `INSERT INTO freeswitch_node_status_snapshots
         (node_id, freeswitch_version, loaded_modules, missing_required_modules,
          sofia_profiles, gateway_statuses, active_channel_count, active_registration_count,
          queried_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, NOW())
       ON CONFLICT (node_id) DO UPDATE SET
         freeswitch_version = EXCLUDED.freeswitch_version,
         loaded_modules = EXCLUDED.loaded_modules,
         missing_required_modules = EXCLUDED.missing_required_modules,
         sofia_profiles = EXCLUDED.sofia_profiles,
         gateway_statuses = EXCLUDED.gateway_statuses,
         active_channel_count = EXCLUDED.active_channel_count,
         active_registration_count = EXCLUDED.active_registration_count,
         queried_at = NOW()
       RETURNING ${COLS}`,
      [
        input.node_id,
        input.freeswitch_version ?? null,
        input.loaded_modules ?? [],
        input.missing_required_modules ?? [],
        JSON.stringify(input.sofia_profiles ?? {}),
        JSON.stringify(input.gateway_statuses ?? {}),
        input.active_channel_count ?? null,
        input.active_registration_count ?? null,
      ],
    );
    return r.rows[0]!;
  }

  async findByNode(nodeId: string): Promise<NodeStatusSnapshot | null> {
    const r = await this.db.query<NodeStatusSnapshot>(
      `SELECT ${COLS} FROM freeswitch_node_status_snapshots WHERE node_id = $1`,
      [nodeId],
    );
    return r.rows[0] ?? null;
  }

  async findAll(): Promise<NodeStatusSnapshot[]> {
    const r = await this.db.query<NodeStatusSnapshot>(
      `SELECT ${COLS} FROM freeswitch_node_status_snapshots ORDER BY queried_at DESC`,
    );
    return r.rows;
  }
}
