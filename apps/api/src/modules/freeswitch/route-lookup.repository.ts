import type { Pool } from 'pg';

export interface RouteMatch {
  route_id: string;
  tenant_id: string;
  match_type: string;
  match_value: string;
  target_type: 'extension' | 'flow';
  target_id: string | null;
}

export interface ExtensionTarget {
  extension_number: string;
  sip_username: string;
  display_name: string;
  directory_domain: string | null;
}

export interface FlowTarget {
  name: string;
  definition: Record<string, unknown> | null;
}

export class RouteLookupRepository {
  constructor(private readonly db: Pool) {}

  async findRouteForCall(did: string, trunkName?: string): Promise<RouteMatch | null> {
    const r = await this.db.query<RouteMatch>(
      `SELECT
         ir.id AS route_id,
         ir.tenant_id,
         ir.match_type,
         ir.match_value,
         ir.target_type,
         ir.target_id
       FROM inbound_routes ir
       LEFT JOIN phone_numbers pn ON pn.id = ir.phone_number_id
       WHERE ir.status = 'active'
         AND (
           (ir.match_type = 'did' AND ir.phone_number_id IS NOT NULL AND pn.e164_number = $1)
           OR (ir.match_type = 'did' AND ir.phone_number_id IS NULL AND ir.match_value = $1)
           OR (ir.match_type = 'trunk' AND $2::text IS NOT NULL AND ir.match_value = $2)
           OR (ir.match_type = 'pattern' AND $1 ~ ir.match_value)
         )
       ORDER BY
         CASE
           WHEN ir.match_type = 'did' AND ir.phone_number_id IS NOT NULL THEN 0
           WHEN ir.match_type = 'did' THEN 1
           WHEN ir.match_type = 'trunk' THEN 2
           WHEN ir.match_type = 'pattern' THEN 3
           ELSE 4
         END
       LIMIT 1`,
      [did, trunkName ?? null],
    );
    return r.rows[0] ?? null;
  }

  async findExtensionTarget(extensionId: string): Promise<ExtensionTarget | null> {
    const r = await this.db.query<ExtensionTarget>(
      `SELECT e.extension_number, e.sip_username, e.display_name, t.directory_domain
       FROM extensions e
       JOIN tenants t ON t.id = e.tenant_id
       WHERE e.id = $1 AND e.status = 'active'`,
      [extensionId],
    );
    return r.rows[0] ?? null;
  }

  async findFlowTarget(flowId: string): Promise<FlowTarget | null> {
    const r = await this.db.query<FlowTarget>(
      `SELECT f.name, fv.definition
       FROM ivr_flows f
       LEFT JOIN flow_versions fv ON fv.id = f.active_version_id
       WHERE f.id = $1 AND f.status = 'active'`,
      [flowId],
    );
    return r.rows[0] ?? null;
  }
}
