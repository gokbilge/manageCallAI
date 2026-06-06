import type { SiteRepository } from './site.repository.js';
import type {
  CreateSiteInput,
  CreateSiteLocationInput,
  Site,
  SiteLocation,
  SiteWithLocations,
  UpdateSiteInput,
} from './site.types.js';

export class SiteNotFoundError extends Error {
  constructor(id: string) { super(`Site not found: ${id}`); this.name = 'SiteNotFoundError'; }
}

export class SiteLocationNotFoundError extends Error {
  constructor(id: string) { super(`Site location not found: ${id}`); this.name = 'SiteLocationNotFoundError'; }
}

export class SiteService {
  constructor(private readonly repo: SiteRepository) {}

  create(tenantId: string, input: CreateSiteInput): Promise<Site> {
    return this.repo.create(tenantId, input);
  }

  list(tenantId: string): Promise<Site[]> {
    return this.repo.findAll(tenantId);
  }

  async getById(id: string, tenantId: string): Promise<SiteWithLocations> {
    const site = await this.repo.findById(id, tenantId);
    if (!site) throw new SiteNotFoundError(id);
    return site;
  }

  async update(id: string, tenantId: string, input: UpdateSiteInput): Promise<Site> {
    const site = await this.repo.update(id, tenantId, input);
    if (!site) throw new SiteNotFoundError(id);
    return site;
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const deleted = await this.repo.delete(id, tenantId);
    if (!deleted) throw new SiteNotFoundError(id);
  }

  async addLocation(siteId: string, tenantId: string, input: CreateSiteLocationInput): Promise<SiteLocation> {
    const site = await this.repo.findById(siteId, tenantId);
    if (!site) throw new SiteNotFoundError(siteId);
    return this.repo.createLocation(tenantId, siteId, input);
  }

  async removeLocation(locationId: string, siteId: string, tenantId: string): Promise<void> {
    const deleted = await this.repo.deleteLocation(locationId, siteId, tenantId);
    if (!deleted) throw new SiteLocationNotFoundError(locationId);
  }
}
