import { describe, it, expect, vi } from 'vitest';
import type { Pool } from 'pg';
import { SiteRepository } from './site.repository.js';
import type { Site, SiteLocation } from './site.types.js';

const TENANT = 'tenant-1';
const SITE_ID = 'site-1';
const LOC_ID = 'loc-1';

const baseSite: Site = {
  id: SITE_ID, tenant_id: TENANT, name: 'HQ', description: null,
  address_line1: '123 Main St', address_line2: null, city: 'SF',
  state_region: 'CA', postal_code: '94105', country_code: 'US',
  timezone: 'America/Los_Angeles', language_code: 'en-US', network_zone: 'VLAN-10',
  emergency_number: '911', emergency_outbound_route_id: null,
  default_calling_policy_id: null, default_numbering_plan_id: null, default_outbound_route_id: null,
  status: 'active', created_at: new Date(), updated_at: new Date(),
};

const baseLocation: SiteLocation = {
  id: LOC_ID, tenant_id: TENANT, site_id: SITE_ID,
  name: 'Floor 3', description: null, floor: '3', room: null, created_at: new Date(),
};

function makePool(rows: unknown[] = []): Pool {
  return { query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }) } as unknown as Pool;
}

describe('SiteRepository', () => {
  it('create inserts site and returns it', async () => {
    const pool = makePool([baseSite]);
    const repo = new SiteRepository(pool);
    const result = await repo.create(TENANT, { name: 'HQ', emergency_number: '911' });
    expect(result.name).toBe('HQ');
  });

  it('create with all optional fields', async () => {
    const pool = makePool([baseSite]);
    const repo = new SiteRepository(pool);
    await repo.create(TENANT, {
      name: 'HQ', description: 'desc', address_line1: '123', city: 'SF',
      state_region: 'CA', postal_code: '94105', country_code: 'US',
      timezone: 'UTC', language_code: 'en', network_zone: 'VLAN',
      emergency_number: '911', emergency_outbound_route_id: 'route-1',
      default_calling_policy_id: 'policy-1', default_numbering_plan_id: 'plan-1',
      default_outbound_route_id: 'route-2',
    });
    expect(pool.query).toHaveBeenCalled();
  });

  it('findAll returns sites for tenant', async () => {
    const pool = makePool([baseSite]);
    const repo = new SiteRepository(pool);
    const result = await repo.findAll(TENANT);
    expect(result).toHaveLength(1);
  });

  it('findById returns site with locations', async () => {
    const pool = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [baseSite] })
        .mockResolvedValueOnce({ rows: [baseLocation] }),
    } as unknown as Pool;
    const repo = new SiteRepository(pool);
    const result = await repo.findById(SITE_ID, TENANT);
    expect(result?.id).toBe(SITE_ID);
    expect(result?.locations).toHaveLength(1);
  });

  it('findById returns null when site not found', async () => {
    const pool = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }),
    } as unknown as Pool;
    const repo = new SiteRepository(pool);
    const result = await repo.findById('missing', TENANT);
    expect(result).toBeNull();
  });

  it('update builds dynamic SET clause and returns updated site', async () => {
    const updated = { ...baseSite, name: 'Updated HQ' };
    const pool = makePool([updated]);
    const repo = new SiteRepository(pool);
    const result = await repo.update(SITE_ID, TENANT, {
      name: 'Updated HQ', description: 'New desc', city: 'NYC',
      emergency_number: '112', status: 'inactive',
      default_calling_policy_id: 'policy-1',
    });
    expect(result?.name).toBe('Updated HQ');
  });

  it('update returns null when site not found', async () => {
    const pool = makePool([]);
    const repo = new SiteRepository(pool);
    const result = await repo.update('missing', TENANT, { name: 'X' });
    expect(result).toBeNull();
  });

  it('delete returns true when site deleted', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }) } as unknown as Pool;
    const repo = new SiteRepository(pool);
    expect(await repo.delete(SITE_ID, TENANT)).toBe(true);
  });

  it('delete returns false when site not found', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) } as unknown as Pool;
    const repo = new SiteRepository(pool);
    expect(await repo.delete('missing', TENANT)).toBe(false);
  });

  it('createLocation inserts location and returns it', async () => {
    const pool = makePool([baseLocation]);
    const repo = new SiteRepository(pool);
    const result = await repo.createLocation(TENANT, SITE_ID, { name: 'Floor 3', floor: '3', room: 'A' });
    expect(result.name).toBe('Floor 3');
  });

  it('deleteLocation returns true when deleted', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }) } as unknown as Pool;
    const repo = new SiteRepository(pool);
    expect(await repo.deleteLocation(LOC_ID, SITE_ID, TENANT)).toBe(true);
  });

  it('deleteLocation returns false when not found', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) } as unknown as Pool;
    const repo = new SiteRepository(pool);
    expect(await repo.deleteLocation('missing', SITE_ID, TENANT)).toBe(false);
  });
});
