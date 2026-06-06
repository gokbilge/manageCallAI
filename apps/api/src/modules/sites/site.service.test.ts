import { describe, expect, it, vi } from 'vitest';
import type { SiteRepository } from './site.repository.js';
import { SiteService, SiteNotFoundError, SiteLocationNotFoundError } from './site.service.js';
import type { Site, SiteLocation, SiteWithLocations } from './site.types.js';

const TENANT = 'tenant-1';
const SITE_ID = 'site-1';

const site: Site = {
  id: SITE_ID, tenant_id: TENANT, name: 'HQ', description: null,
  address_line1: '123 Main St', address_line2: null, city: 'San Francisco',
  state_region: 'CA', postal_code: '94105', country_code: 'US',
  timezone: 'America/Los_Angeles', language_code: 'en-US', network_zone: 'VLAN-10',
  emergency_number: '911', emergency_outbound_route_id: null,
  default_calling_policy_id: null, default_numbering_plan_id: null, default_outbound_route_id: null,
  status: 'active', created_at: new Date(), updated_at: new Date(),
};

const location: SiteLocation = {
  id: 'loc-1', tenant_id: TENANT, site_id: SITE_ID,
  name: 'Floor 3', description: null, floor: '3', room: null, created_at: new Date(),
};

const siteWithLocations: SiteWithLocations = { ...site, locations: [location] };

function makeRepo(overrides: Partial<SiteRepository> = {}): SiteRepository {
  return {
    create: vi.fn().mockResolvedValue(site),
    findAll: vi.fn().mockResolvedValue([site]),
    findById: vi.fn().mockResolvedValue(siteWithLocations),
    update: vi.fn().mockResolvedValue({ ...site, name: 'Updated HQ' }),
    delete: vi.fn().mockResolvedValue(true),
    createLocation: vi.fn().mockResolvedValue(location),
    deleteLocation: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as unknown as SiteRepository;
}

describe('SiteService', () => {
  it('creates a site', async () => {
    const svc = new SiteService(makeRepo());
    const r = await svc.create(TENANT, { name: 'HQ', city: 'San Francisco', emergency_number: '911' });
    expect(r.name).toBe('HQ');
  });

  it('lists sites', async () => {
    const svc = new SiteService(makeRepo());
    expect(await svc.list(TENANT)).toHaveLength(1);
  });

  it('gets site by id with locations', async () => {
    const svc = new SiteService(makeRepo());
    const r = await svc.getById(SITE_ID, TENANT);
    expect(r.locations).toHaveLength(1);
    expect(r.locations[0]!.floor).toBe('3');
  });

  it('throws SiteNotFoundError when site missing', async () => {
    const svc = new SiteService(makeRepo({ findById: vi.fn().mockResolvedValue(null) }));
    await expect(svc.getById('missing', TENANT)).rejects.toBeInstanceOf(SiteNotFoundError);
  });

  it('updates a site including emergency defaults (#304)', async () => {
    const svc = new SiteService(makeRepo());
    const r = await svc.update(SITE_ID, TENANT, { emergency_number: '112', default_calling_policy_id: 'policy-1' });
    expect(r.name).toBe('Updated HQ');
  });

  it('throws SiteNotFoundError on update when missing', async () => {
    const svc = new SiteService(makeRepo({ update: vi.fn().mockResolvedValue(null) }));
    await expect(svc.update('missing', TENANT, { name: 'X' })).rejects.toBeInstanceOf(SiteNotFoundError);
  });

  it('deletes a site', async () => {
    const svc = new SiteService(makeRepo());
    await expect(svc.delete(SITE_ID, TENANT)).resolves.toBeUndefined();
  });

  it('throws SiteNotFoundError when deleting missing site', async () => {
    const svc = new SiteService(makeRepo({ delete: vi.fn().mockResolvedValue(false) }));
    await expect(svc.delete('missing', TENANT)).rejects.toBeInstanceOf(SiteNotFoundError);
  });

  it('adds a location to a site', async () => {
    const svc = new SiteService(makeRepo());
    const r = await svc.addLocation(SITE_ID, TENANT, { name: 'Floor 3', floor: '3' });
    expect(r.floor).toBe('3');
  });

  it('throws SiteNotFoundError when adding location to missing site', async () => {
    const svc = new SiteService(makeRepo({ findById: vi.fn().mockResolvedValue(null) }));
    await expect(svc.addLocation('missing', TENANT, { name: 'X' })).rejects.toBeInstanceOf(SiteNotFoundError);
  });

  it('removes a location', async () => {
    const svc = new SiteService(makeRepo());
    await expect(svc.removeLocation('loc-1', SITE_ID, TENANT)).resolves.toBeUndefined();
  });

  it('throws SiteLocationNotFoundError when removing missing location', async () => {
    const svc = new SiteService(makeRepo({ deleteLocation: vi.fn().mockResolvedValue(false) }));
    await expect(svc.removeLocation('missing', SITE_ID, TENANT)).rejects.toBeInstanceOf(SiteLocationNotFoundError);
  });
});
