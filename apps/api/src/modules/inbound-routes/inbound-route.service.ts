import type { InboundRouteRepository } from './inbound-route.repository.js';
import type {
  CreateInboundRouteInput,
  InboundRoute,
  InboundRouteWithVersions,
  RouteVersion,
  UpdateInboundRouteInput,
  ValidationOutcome,
} from './inbound-route.types.js';

export class InboundRouteNotFoundError extends Error {
  constructor(id: string) { super(`Inbound route not found: ${id}`); this.name = 'InboundRouteNotFoundError'; }
}

export class RouteVersionNotFoundError extends Error {
  constructor(id: string) { super(`Route version not found: ${id}`); this.name = 'RouteVersionNotFoundError'; }
}

export class RouteVersionStateError extends Error {
  constructor(msg: string) { super(msg); this.name = 'RouteVersionStateError'; }
}

export class RollbackNotAvailableError extends Error {
  constructor() { super('No superseded version available for rollback'); this.name = 'RollbackNotAvailableError'; }
}

async function validateRoute(
  repo: InboundRouteRepository,
  route: InboundRoute,
  version: RouteVersion,
  tenantId: string,
): Promise<ValidationOutcome> {
  const errors: { field: string; message: string }[] = [];
  const warnings: { field: string; message: string }[] = [];

  if (!route.target_id) {
    errors.push({ field: 'target_id', message: 'Route must have a target_id to be published' });
  } else {
    const exists = await repo.targetExists(route.target_type, route.target_id, tenantId);
    if (!exists) {
      errors.push({
        field: 'target_id',
        message: `Target ${route.target_type} '${route.target_id}' does not exist or is not active`,
      });
    }
  }

  const hasConflict = await repo.hasConflictingActiveRoute(tenantId, route.match_type, route.match_value, route.id);
  if (hasConflict) {
    errors.push({
      field: 'match_value',
      message: `An active route already exists for ${route.match_type}='${route.match_value}'`,
    });
  }

  const def = version.definition as Record<string, unknown>;
  if (!def['match_value']) {
    warnings.push({ field: 'definition.match_value', message: 'match_value is empty in version definition' });
  }

  return { status: errors.length > 0 ? 'failed' : 'passed', errors, warnings };
}

export class InboundRouteService {
  constructor(private readonly repo: InboundRouteRepository) {}

  listByTenant(tenantId: string): Promise<InboundRoute[]> {
    return this.repo.findAllByTenant(tenantId);
  }

  async getById(id: string, tenantId: string): Promise<InboundRouteWithVersions> {
    const route = await this.repo.findById(id, tenantId);
    if (!route) throw new InboundRouteNotFoundError(id);
    return route;
  }

  create(input: CreateInboundRouteInput): Promise<InboundRouteWithVersions> {
    return this.repo.create(input);
  }

  async update(id: string, tenantId: string, input: UpdateInboundRouteInput): Promise<InboundRoute> {
    const route = await this.repo.update(id, tenantId, input);
    if (!route) throw new InboundRouteNotFoundError(id);
    return route;
  }

  async createVersion(routeId: string, tenantId: string, definition: Record<string, unknown>, createdBy?: string): Promise<RouteVersion> {
    const route = await this.repo.findById(routeId, tenantId);
    if (!route) throw new InboundRouteNotFoundError(routeId);
    const nextNum = await this.repo.nextVersionNumber(routeId);
    return this.repo.createVersion({ tenant_id: tenantId, route_id: routeId, version_number: nextNum, definition, created_by: createdBy });
  }

  async validate(routeId: string, versionId: string, tenantId: string): Promise<{ version: RouteVersion; outcome: ValidationOutcome }> {
    const route = await this.repo.findById(routeId, tenantId);
    if (!route) throw new InboundRouteNotFoundError(routeId);

    const version = await this.repo.findVersionById(versionId, routeId, tenantId);
    if (!version) throw new RouteVersionNotFoundError(versionId);

    const outcome = await validateRoute(this.repo, route, version, tenantId);

    await this.repo.storeValidationResult({ tenant_id: tenantId, route_id: routeId, version_id: versionId, outcome });

    if (outcome.status === 'passed') {
      const updated = await this.repo.markVersionValidated(versionId, routeId, tenantId);
      return { version: updated ?? version, outcome };
    }

    return { version, outcome };
  }

  async publish(routeId: string, versionId: string, tenantId: string, triggeredById: string): Promise<InboundRoute> {
    const version = await this.repo.findVersionById(versionId, routeId, tenantId);
    if (!version) throw new RouteVersionNotFoundError(versionId);
    if (version.state !== 'validated') {
      throw new RouteVersionStateError(`Version must be in 'validated' state to publish; current state: ${version.state}`);
    }
    return this.repo.publish({ tenant_id: tenantId, route_id: routeId, version_id: versionId, triggered_by_id: triggeredById });
  }

  async rollback(routeId: string, tenantId: string, triggeredById: string): Promise<InboundRoute> {
    const route = await this.repo.findById(routeId, tenantId);
    if (!route) throw new InboundRouteNotFoundError(routeId);
    const result = await this.repo.rollback({ tenant_id: tenantId, route_id: routeId, triggered_by_id: triggeredById });
    if (!result) throw new RollbackNotAvailableError();
    return result.route;
  }
}
