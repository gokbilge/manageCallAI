import type { Pool } from 'pg';
import type {
  AddQueueMemberInput,
  CreateQueueInput,
  Queue,
  QueueMember,
  QueueWithMembers,
  UpdateQueueInput,
} from './queue.types.js';

export class QueueRepository {
  constructor(private readonly db: Pool) {}

  async findAllByTenant(tenantId: string): Promise<Queue[]> {
    const r = await this.db.query<Queue>(
      `SELECT id, tenant_id, name, description, strategy, ring_timeout_seconds, status, created_at, updated_at
       FROM queues WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [tenantId],
    );
    return r.rows;
  }

  async findById(id: string, tenantId: string): Promise<QueueWithMembers | null> {
    const queueR = await this.db.query<Queue>(
      `SELECT id, tenant_id, name, description, strategy, ring_timeout_seconds, status, created_at, updated_at
       FROM queues WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (!queueR.rows[0]) return null;

    const membersR = await this.db.query<QueueMember>(
      `SELECT qm.id, qm.queue_id, qm.tenant_id, qm.extension_id,
              e.extension_number, e.display_name, qm.position, qm.created_at
       FROM queue_members qm
       JOIN extensions e ON e.id = qm.extension_id
       WHERE qm.queue_id = $1
       ORDER BY qm.position, qm.created_at`,
      [id],
    );
    return { ...queueR.rows[0]!, members: membersR.rows };
  }

  async create(input: CreateQueueInput): Promise<QueueWithMembers> {
    const r = await this.db.query<Queue>(
      `INSERT INTO queues (tenant_id, name, description, strategy, ring_timeout_seconds)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, tenant_id, name, description, strategy, ring_timeout_seconds, status, created_at, updated_at`,
      [
        input.tenant_id,
        input.name,
        input.description ?? null,
        input.strategy ?? 'simultaneous',
        input.ring_timeout_seconds ?? 20,
      ],
    );
    return { ...r.rows[0]!, members: [] };
  }

  async update(id: string, tenantId: string, input: UpdateQueueInput): Promise<Queue | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (input.name !== undefined) { fields.push(`name = $${idx++}`); values.push(input.name); }
    if ('description' in input) { fields.push(`description = $${idx++}`); values.push(input.description ?? null); }
    if (input.strategy !== undefined) { fields.push(`strategy = $${idx++}`); values.push(input.strategy); }
    if (input.ring_timeout_seconds !== undefined) { fields.push(`ring_timeout_seconds = $${idx++}`); values.push(input.ring_timeout_seconds); }
    if (input.status !== undefined) { fields.push(`status = $${idx++}`); values.push(input.status); }

    if (fields.length === 0) {
      const r = await this.db.query<Queue>(
        `SELECT id, tenant_id, name, description, strategy, ring_timeout_seconds, status, created_at, updated_at
         FROM queues WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId],
      );
      return r.rows[0] ?? null;
    }

    fields.push('updated_at = NOW()');
    values.push(id, tenantId);
    const r = await this.db.query<Queue>(
      `UPDATE queues SET ${fields.join(', ')}
       WHERE id = $${idx} AND tenant_id = $${idx + 1}
       RETURNING id, tenant_id, name, description, strategy, ring_timeout_seconds, status, created_at, updated_at`,
      values,
    );
    return r.rows[0] ?? null;
  }

  async deactivate(id: string, tenantId: string): Promise<Queue | null> {
    const r = await this.db.query<Queue>(
      `UPDATE queues SET status = 'inactive', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING id, tenant_id, name, description, strategy, ring_timeout_seconds, status, created_at, updated_at`,
      [id, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async findActiveExtension(extensionId: string, tenantId: string): Promise<{ id: string } | null> {
    const r = await this.db.query<{ id: string }>(
      `SELECT id FROM extensions WHERE id = $1 AND tenant_id = $2 AND status = 'active'`,
      [extensionId, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async addMember(queueId: string, tenantId: string, input: AddQueueMemberInput): Promise<QueueMember> {
    const r = await this.db.query<QueueMember>(
      `INSERT INTO queue_members (queue_id, tenant_id, extension_id, position)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (queue_id, extension_id) DO UPDATE SET position = EXCLUDED.position
       RETURNING id, queue_id, tenant_id, extension_id, position, created_at`,
      [queueId, tenantId, input.extension_id, input.position ?? 0],
    );
    const row = r.rows[0]!;
    const extR = await this.db.query<{ extension_number: string; display_name: string }>(
      `SELECT extension_number, display_name FROM extensions WHERE id = $1`,
      [input.extension_id],
    );
    return { ...row, ...extR.rows[0]! };
  }

  async removeMember(queueId: string, extensionId: string, tenantId: string): Promise<boolean> {
    const r = await this.db.query(
      `DELETE FROM queue_members
       WHERE queue_id = $1 AND extension_id = $2
         AND tenant_id = (SELECT tenant_id FROM queues WHERE id = $1 AND tenant_id = $3 LIMIT 1)`,
      [queueId, extensionId, tenantId],
    );
    return (r.rowCount ?? 0) > 0;
  }

  async isActiveTarget(id: string, tenantId: string): Promise<boolean> {
    const r = await this.db.query<{ id: string }>(
      `SELECT id FROM queues WHERE id = $1 AND tenant_id = $2 AND status = 'active'`,
      [id, tenantId],
    );
    return r.rows.length > 0;
  }
}
