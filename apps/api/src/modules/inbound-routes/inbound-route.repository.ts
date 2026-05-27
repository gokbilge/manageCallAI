import type { Pool } from 'pg';
import type {
  CreateInboundRouteInput,
  InboundRoute,
  InboundRouteWithVersions,
  RouteVersion,
  UpdateInboundRouteInput,
  ValidationOutcome,
} from './inbound-route.types.js';

export class InboundRouteRepository {
  constructor(private readonly db: Pool) {}

  async findAllByTenant(tenantId: string): Promise<InboundRoute[]> {
    const r = await this.db.query<InboundRoute>(
      `SELECT id, tenant_id, name, match_type, match_value, phone_number_id, target_type, target_id,
              status, draft_version_id, active_version_id, created_at, updated_at
       FROM inbound_routes WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
    return r.rows;
  }

  async findById(id: string, tenantId: string): Promise<InboundRouteWithVersions | null> {
    const routeR = await this.db.query<InboundRoute>(
      `SELECT id, tenant_id, name, match_type, match_value, phone_number_id, target_type, target_id,
              status, draft_version_id, active_version_id, created_at, updated_at
       FROM inbound_routes WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (!routeR.rows[0]) return null;

    const versionsR = await this.db.query<RouteVersion>(
      `SELECT id, tenant_id, route_type, route_id, version_number, state, definition,
              created_by, created_at, validated_at, published_at
       FROM route_versions WHERE route_id = $1 AND route_type = 'inbound' ORDER BY version_number DESC`,
      [id],
    );
    return { ...routeR.rows[0], versions: versionsR.rows };
  }

  async findVersionById(versionId: string, routeId: string, tenantId: string): Promise<RouteVersion | null> {
    const r = await this.db.query<RouteVersion>(
      `SELECT rv.id, rv.tenant_id, rv.route_type, rv.route_id, rv.version_number, rv.state,
              rv.definition, rv.created_by, rv.created_at, rv.validated_at, rv.published_at
       FROM route_versions rv
       JOIN inbound_routes ir ON ir.id = rv.route_id
       WHERE rv.id = $1 AND rv.route_id = $2 AND ir.tenant_id = $3 AND rv.route_type = 'inbound'`,
      [versionId, routeId, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async create(input: CreateInboundRouteInput): Promise<InboundRouteWithVersions> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');

      const routeR = await client.query<InboundRoute>(
        `INSERT INTO inbound_routes (tenant_id, name, match_type, match_value, phone_number_id, target_type, target_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft')
         RETURNING id, tenant_id, name, match_type, match_value, phone_number_id, target_type, target_id,
                   status, draft_version_id, active_version_id, created_at, updated_at`,
        [
          input.tenant_id,
          input.name,
          input.match_type,
          input.match_value,
          input.phone_number_id ?? null,
          input.target_type,
          input.target_id ?? null,
        ],
      );
      const route = routeR.rows[0]!;

      const definition: Record<string, unknown> = {
        match_type: input.match_type,
        match_value: input.match_value,
        phone_number_id: input.phone_number_id ?? null,
        target_type: input.target_type,
        target_id: input.target_id ?? null,
      };

      const versionR = await client.query<RouteVersion>(
        `INSERT INTO route_versions (tenant_id, route_type, route_id, version_number, state, definition, created_by)
         VALUES ($1, 'inbound', $2, 1, 'draft', $3, $4)
         RETURNING id, tenant_id, route_type, route_id, version_number, state, definition,
                   created_by, created_at, validated_at, published_at`,
        [input.tenant_id, route.id, JSON.stringify(definition), input.created_by ?? null],
      );
      const version = versionR.rows[0]!;

      await client.query(
        `UPDATE inbound_routes SET draft_version_id = $1, updated_at = NOW() WHERE id = $2`,
        [version.id, route.id],
      );

      await client.query('COMMIT');
      return { ...route, draft_version_id: version.id, versions: [version] };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async update(id: string, tenantId: string, input: UpdateInboundRouteInput): Promise<InboundRoute | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    const cols = ['name', 'match_type', 'match_value', 'target_type'] as const;
    for (const col of cols) {
      if (col in input && input[col] !== undefined) { fields.push(`${col} = $${idx++}`); values.push(input[col]); }
    }
    if ('phone_number_id' in input) { fields.push(`phone_number_id = $${idx++}`); values.push(input.phone_number_id ?? null); }
    if ('target_id' in input) { fields.push(`target_id = $${idx++}`); values.push(input.target_id ?? null); }
    if (fields.length === 0) {
      const r = await this.db.query<InboundRoute>(
        `SELECT id, tenant_id, name, match_type, match_value, phone_number_id, target_type, target_id,
                status, draft_version_id, active_version_id, created_at, updated_at
         FROM inbound_routes WHERE id = $1 AND tenant_id = $2`,
        [id, tenantId],
      );
      return r.rows[0] ?? null;
    }
    fields.push(`updated_at = NOW()`);
    values.push(id, tenantId);
    const r = await this.db.query<InboundRoute>(
      `UPDATE inbound_routes SET ${fields.join(', ')} WHERE id = $${idx} AND tenant_id = $${idx + 1}
       RETURNING id, tenant_id, name, match_type, match_value, phone_number_id, target_type, target_id,
                 status, draft_version_id, active_version_id, created_at, updated_at`,
      values,
    );
    return r.rows[0] ?? null;
  }

  async createVersion(input: {
    tenant_id: string;
    route_id: string;
    version_number: number;
    definition: Record<string, unknown>;
    created_by?: string;
  }): Promise<RouteVersion> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const versionR = await client.query<RouteVersion>(
        `INSERT INTO route_versions (tenant_id, route_type, route_id, version_number, state, definition, created_by)
         VALUES ($1, 'inbound', $2, $3, 'draft', $4, $5)
         RETURNING id, tenant_id, route_type, route_id, version_number, state, definition,
                   created_by, created_at, validated_at, published_at`,
        [input.tenant_id, input.route_id, input.version_number, JSON.stringify(input.definition), input.created_by ?? null],
      );
      const version = versionR.rows[0]!;
      await client.query(
        `UPDATE inbound_routes SET draft_version_id = $1, updated_at = NOW() WHERE id = $2`,
        [version.id, input.route_id],
      );
      await client.query('COMMIT');
      return version;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async markVersionValidated(versionId: string, routeId: string, tenantId: string): Promise<RouteVersion | null> {
    const r = await this.db.query<RouteVersion>(
      `UPDATE route_versions SET state = 'validated', validated_at = NOW()
       WHERE id = $1 AND route_id = $2
         AND tenant_id = (SELECT tenant_id FROM inbound_routes WHERE id = $2 AND tenant_id = $3 LIMIT 1)
       RETURNING id, tenant_id, route_type, route_id, version_number, state, definition,
                 created_by, created_at, validated_at, published_at`,
      [versionId, routeId, tenantId],
    );
    return r.rows[0] ?? null;
  }

  async storeValidationResult(input: {
    tenant_id: string;
    route_id: string;
    version_id: string;
    outcome: ValidationOutcome;
  }): Promise<void> {
    await this.db.query(
      `INSERT INTO validation_results (tenant_id, object_type, object_id, version_id, validator_version, status, errors, warnings)
       VALUES ($1, 'inbound_route', $2, $3, '1.0', $4, $5, $6)`,
      [
        input.tenant_id,
        input.route_id,
        input.version_id,
        input.outcome.status,
        JSON.stringify(input.outcome.errors),
        JSON.stringify(input.outcome.warnings),
      ],
    );
  }

  async publish(input: {
    tenant_id: string;
    route_id: string;
    version_id: string;
    triggered_by_id: string;
  }): Promise<InboundRoute> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE route_versions SET state = 'superseded' WHERE route_id = $1 AND route_type = 'inbound' AND state = 'published'`,
        [input.route_id],
      );
      await client.query(
        `UPDATE route_versions SET state = 'published', published_at = NOW() WHERE id = $1`,
        [input.version_id],
      );
      const routeR = await client.query<InboundRoute>(
        `UPDATE inbound_routes SET active_version_id = $1, status = 'active', updated_at = NOW()
         WHERE id = $2
         RETURNING id, tenant_id, name, match_type, match_value, phone_number_id, target_type, target_id,
                   status, draft_version_id, active_version_id, created_at, updated_at`,
        [input.version_id, input.route_id],
      );
      await client.query(
        `INSERT INTO publish_records (tenant_id, object_type, object_id, version_id, action_type, triggered_by_type, triggered_by_id, result)
         VALUES ($1, 'inbound_route', $2, $3, 'publish', 'user', $4, 'success')`,
        [input.tenant_id, input.route_id, input.version_id, input.triggered_by_id],
      );
      await client.query(
        `INSERT INTO audit_events (tenant_id, actor_type, actor_id, action, object_type, object_id)
         VALUES ($1, 'user', $2, 'publish', 'inbound_route', $3)`,
        [input.tenant_id, input.triggered_by_id, input.route_id],
      );
      await client.query('COMMIT');
      return routeR.rows[0]!;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async rollback(input: {
    tenant_id: string;
    route_id: string;
    triggered_by_id: string;
  }): Promise<{ route: InboundRoute; target_version_id: string } | null> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const targetR = await client.query<{ id: string; version_number: number }>(
        `SELECT id, version_number FROM route_versions
         WHERE route_id = $1 AND route_type = 'inbound' AND state = 'superseded'
         ORDER BY version_number DESC LIMIT 1`,
        [input.route_id],
      );
      const target = targetR.rows[0];
      if (!target) { await client.query('ROLLBACK'); return null; }
      await client.query(
        `UPDATE route_versions SET state = 'superseded' WHERE route_id = $1 AND route_type = 'inbound' AND state = 'published'`,
        [input.route_id],
      );
      await client.query(
        `UPDATE route_versions SET state = 'published', published_at = NOW() WHERE id = $1`,
        [target.id],
      );
      const routeR = await client.query<InboundRoute>(
        `UPDATE inbound_routes SET active_version_id = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, tenant_id, name, match_type, match_value, phone_number_id, target_type, target_id,
                   status, draft_version_id, active_version_id, created_at, updated_at`,
        [target.id, input.route_id],
      );
      await client.query(
        `INSERT INTO publish_records (tenant_id, object_type, object_id, version_id, action_type, triggered_by_type, triggered_by_id, result)
         VALUES ($1, 'inbound_route', $2, $3, 'rollback', 'user', $4, 'success')`,
        [input.tenant_id, input.route_id, target.id, input.triggered_by_id],
      );
      await client.query(
        `INSERT INTO audit_events (tenant_id, actor_type, actor_id, action, object_type, object_id)
         VALUES ($1, 'user', $2, 'rollback', 'inbound_route', $3)`,
        [input.tenant_id, input.triggered_by_id, input.route_id],
      );
      await client.query('COMMIT');
      return { route: routeR.rows[0]!, target_version_id: target.id };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async nextVersionNumber(routeId: string): Promise<number> {
    const r = await this.db.query<{ max: number | null }>(
      `SELECT MAX(version_number) AS max FROM route_versions WHERE route_id = $1 AND route_type = 'inbound'`,
      [routeId],
    );
    return (r.rows[0]?.max ?? 0) + 1;
  }

  async targetExists(target_type: 'flow' | 'extension', target_id: string, tenantId: string): Promise<boolean> {
    if (target_type === 'flow') {
      const r = await this.db.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM ivr_flows WHERE id = $1 AND tenant_id = $2 AND status = 'active'`,
        [target_id, tenantId],
      );
      return parseInt(r.rows[0]?.count ?? '0', 10) > 0;
    }
    const r = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM extensions WHERE id = $1 AND tenant_id = $2 AND status = 'active'`,
      [target_id, tenantId],
    );
    return parseInt(r.rows[0]?.count ?? '0', 10) > 0;
  }

  async findPhoneNumberById(phoneNumberId: string, tenantId: string): Promise<{ id: string; e164_number: string; status: string } | null> {
    const result = await this.db.query<{ id: string; e164_number: string; status: string }>(
      `SELECT id, e164_number, status
       FROM phone_numbers
       WHERE id = $1 AND tenant_id = $2`,
      [phoneNumberId, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async hasConflictingActiveRoute(tenantId: string, matchType: string, matchValue: string, excludeRouteId?: string): Promise<boolean> {
    const r = await this.db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM inbound_routes
       WHERE tenant_id = $1 AND match_type = $2 AND match_value = $3 AND status = 'active'
         AND ($4::uuid IS NULL OR id != $4)`,
      [tenantId, matchType, matchValue, excludeRouteId ?? null],
    );
    return parseInt(r.rows[0]?.count ?? '0', 10) > 0;
  }
}
