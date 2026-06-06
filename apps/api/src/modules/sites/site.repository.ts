import type { Pool } from 'pg';
import type {
  CreateSiteInput,
  CreateSiteLocationInput,
  Site,
  SiteLocation,
  SiteWithLocations,
  UpdateSiteInput,
} from './site.types.js';

const siteCols = `id, tenant_id, name, description, address_line1, address_line2, city,
  state_region, postal_code, country_code, timezone, language_code, network_zone,
  emergency_number, emergency_outbound_route_id, default_calling_policy_id,
  default_numbering_plan_id, default_outbound_route_id, status, created_at, updated_at`;

const locCols = `id, tenant_id, site_id, name, description, floor, room, created_at`;

export class SiteRepository {
  constructor(private readonly db: Pool) {}

  async create(tenantId: string, input: CreateSiteInput): Promise<Site> {
    const r = await this.db.query<Site>(
      `INSERT INTO sites (tenant_id, name, description, address_line1, address_line2, city,
         state_region, postal_code, country_code, timezone, language_code, network_zone,
         emergency_number, emergency_outbound_route_id, default_calling_policy_id,
         default_numbering_plan_id, default_outbound_route_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING ${siteCols}`,
      [
        tenantId, input.name, input.description ?? null,
        input.address_line1 ?? null, input.address_line2 ?? null, input.city ?? null,
        input.state_region ?? null, input.postal_code ?? null, input.country_code ?? null,
        input.timezone ?? null, input.language_code ?? null, input.network_zone ?? null,
        input.emergency_number ?? '911',
        input.emergency_outbound_route_id ?? null,
        input.default_calling_policy_id ?? null,
        input.default_numbering_plan_id ?? null,
        input.default_outbound_route_id ?? null,
      ],
    );
    return r.rows[0]!;
  }

  async findAll(tenantId: string): Promise<Site[]> {
    const r = await this.db.query<Site>(
      `SELECT ${siteCols} FROM sites WHERE tenant_id = $1 ORDER BY name`,
      [tenantId],
    );
    return r.rows;
  }

  async findById(id: string, tenantId: string): Promise<SiteWithLocations | null> {
    const [siteR, locR] = await Promise.all([
      this.db.query<Site>(`SELECT ${siteCols} FROM sites WHERE id = $1 AND tenant_id = $2`, [id, tenantId]),
      this.db.query<SiteLocation>(`SELECT ${locCols} FROM site_locations WHERE site_id = $1 AND tenant_id = $2 ORDER BY name`, [id, tenantId]),
    ]);
    if (!siteR.rows[0]) return null;
    return { ...siteR.rows[0], locations: locR.rows };
  }

  async update(id: string, tenantId: string, input: UpdateSiteInput): Promise<Site | null> {
    const sets: string[] = ['updated_at = NOW()'];
    const vals: unknown[] = [id, tenantId];
    let i = 3;
    const fields: Array<[string, unknown]> = [
      ['name', input.name], ['description', input.description],
      ['address_line1', input.address_line1], ['address_line2', input.address_line2],
      ['city', input.city], ['state_region', input.state_region],
      ['postal_code', input.postal_code], ['country_code', input.country_code],
      ['timezone', input.timezone], ['language_code', input.language_code],
      ['network_zone', input.network_zone], ['emergency_number', input.emergency_number],
      ['emergency_outbound_route_id', input.emergency_outbound_route_id],
      ['default_calling_policy_id', input.default_calling_policy_id],
      ['default_numbering_plan_id', input.default_numbering_plan_id],
      ['default_outbound_route_id', input.default_outbound_route_id],
      ['status', input.status],
    ];
    for (const [col, val] of fields) {
      if (val !== undefined) { sets.push(`${col} = $${i}`); vals.push(val); i++; }
    }
    const r = await this.db.query<Site>(
      `UPDATE sites SET ${sets.join(', ')} WHERE id = $1 AND tenant_id = $2 RETURNING ${siteCols}`,
      vals,
    );
    return r.rows[0] ?? null;
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    const r = await this.db.query(`DELETE FROM sites WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    return (r.rowCount ?? 0) > 0;
  }

  async createLocation(tenantId: string, siteId: string, input: CreateSiteLocationInput): Promise<SiteLocation> {
    const r = await this.db.query<SiteLocation>(
      `INSERT INTO site_locations (tenant_id, site_id, name, description, floor, room)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${locCols}`,
      [tenantId, siteId, input.name, input.description ?? null, input.floor ?? null, input.room ?? null],
    );
    return r.rows[0]!;
  }

  async deleteLocation(locationId: string, siteId: string, tenantId: string): Promise<boolean> {
    const r = await this.db.query(
      `DELETE FROM site_locations WHERE id = $1 AND site_id = $2 AND tenant_id = $3`,
      [locationId, siteId, tenantId],
    );
    return (r.rowCount ?? 0) > 0;
  }
}
