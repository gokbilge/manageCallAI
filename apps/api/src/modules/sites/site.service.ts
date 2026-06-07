import type { SiteRepository } from './site.repository.js';
import type {
  CreateSiteInput,
  CreateSiteLocationInput,
  Site,
  SiteLocation,
  SiteWithLocations,
  UpdateSiteInput,
} from './site.types.js';
import type { EnterpriseLifecycleService } from '../shared/enterprise-lifecycle.service.js';
import type {
  EnterpriseVersion,
  EnterpriseValidationResult,
  EnterpriseSimulationResult,
  EnterpriseDryRunResult,
  EnterprisePublishAttemptResult,
} from '../shared/enterprise-lifecycle.types.js';
import type { Role } from '../auth/capabilities.js';

export class SiteNotFoundError extends Error {
  constructor(id: string) { super(`Site not found: ${id}`); this.name = 'SiteNotFoundError'; }
}

export class SiteLocationNotFoundError extends Error {
  constructor(id: string) { super(`Site location not found: ${id}`); this.name = 'SiteLocationNotFoundError'; }
}

export class SiteService {
  constructor(
    private readonly repo: SiteRepository,
    private readonly lifecycleSvc?: EnterpriseLifecycleService,
  ) {}

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

  // ── Publish lifecycle (#319, #321) ────────────────────────────────────────

  private get lifecycle(): EnterpriseLifecycleService {
    if (!this.lifecycleSvc) throw new Error('EnterpriseLifecycleService not provided');
    return this.lifecycleSvc;
  }

  createVersion(siteId: string, tenantId: string, definition: Record<string, unknown>, createdBy?: string, metadata?: Record<string, unknown>): Promise<EnterpriseVersion> {
    return this.lifecycle.createVersion('site', siteId, tenantId, definition, createdBy, metadata);
  }

  listVersions(siteId: string, tenantId: string): Promise<EnterpriseVersion[]> {
    return this.lifecycle.listVersions('site', siteId, tenantId);
  }

  async validate(siteId: string, versionId: string, tenantId: string): Promise<EnterpriseValidationResult> {
    const site = await this.repo.findById(siteId, tenantId);
    if (!site) throw new SiteNotFoundError(siteId);
    return this.lifecycle.validate('site', siteId, versionId, tenantId, async () => {
      const errors: { field: string; message: string }[] = [];
      if (!site.name || site.name.trim().length === 0) {
        errors.push({ field: 'name', message: 'Site name is required.' });
      }
      return { status: errors.length === 0 ? 'passed' : 'failed', errors, warnings: [] };
    });
  }

  async simulate(siteId: string, versionId: string, tenantId: string, scenario: Record<string, unknown>): Promise<EnterpriseSimulationResult> {
    const site = await this.repo.findById(siteId, tenantId);
    if (!site) throw new SiteNotFoundError(siteId);
    const outcome = {
      status: 'passed',
      site_id: siteId,
      site_name: site.name,
      scenario,
      notes: 'Site configuration is structurally valid for routing.',
    };
    return this.lifecycle.simulate('site', siteId, versionId, tenantId, scenario, async () => outcome);
  }

  dryRunPublish(siteId: string, versionId: string, tenantId: string, actorType: 'user' | 'workflow' | 'ai_agent' | 'system' = 'user', actorRole?: Role): Promise<EnterpriseDryRunResult> {
    return this.lifecycle.dryRunPublish('site', siteId, versionId, tenantId, actorType, actorRole);
  }

  publish(siteId: string, versionId: string, tenantId: string, triggeredById: string, actorRole?: Role, actorType: 'user' | 'workflow' | 'ai_agent' | 'system' = 'user'): Promise<EnterprisePublishAttemptResult> {
    return this.lifecycle.publish('site', siteId, versionId, tenantId, triggeredById, actorRole, actorType);
  }

  rollback(siteId: string, tenantId: string, triggeredById: string, actorRole?: Role, actorType: 'user' | 'workflow' | 'ai_agent' | 'system' = 'user'): Promise<EnterprisePublishAttemptResult> {
    return this.lifecycle.rollback('site', siteId, tenantId, triggeredById, actorRole, actorType);
  }
}
