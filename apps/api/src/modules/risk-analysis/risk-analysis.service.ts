import type { RiskAnalysisRepository } from './risk-analysis.repository.js';
import type {
  AffectedObject,
  RiskConcern,
  RiskLevel,
  RiskTargetType,
  RouteRiskAnalysis,
} from './risk-analysis.types.js';

export class RiskAnalysisTargetNotFoundError extends Error {
  constructor(type: string, id: string) {
    super(`Risk analysis target not found: ${type} ${id}`);
    this.name = 'RiskAnalysisTargetNotFoundError';
  }
}

export class RiskAnalysisUnsupportedTargetError extends Error {
  constructor(type: string) {
    super(`Unsupported risk analysis target type: ${type}`);
    this.name = 'RiskAnalysisUnsupportedTargetError';
  }
}

function computeRiskLevel(concerns: RiskConcern[], affectedCount: number): RiskLevel {
  if (concerns.some(c => c.severity === 'error')) return 'high';
  if (concerns.some(c => c.severity === 'warning') || affectedCount >= 2) return 'medium';
  return 'low';
}

export class RouteRiskAnalysisService {
  constructor(private readonly repo: RiskAnalysisRepository) {}

  async analyze(targetType: RiskTargetType, targetId: string, tenantId: string): Promise<RouteRiskAnalysis> {
    switch (targetType) {
      case 'outbound_route': return this.analyzeOutboundRoute(targetId, tenantId);
      case 'inbound_route':  return this.analyzeInboundRoute(targetId, tenantId);
      case 'sip_trunk':      return this.analyzeSipTrunk(targetId, tenantId);
      default:
        throw new RiskAnalysisUnsupportedTargetError(targetType as string);
    }
  }

  private async analyzeOutboundRoute(id: string, tenantId: string): Promise<RouteRiskAnalysis> {
    const route = await this.repo.findOutboundRoute(id, tenantId);
    if (!route) throw new RiskAnalysisTargetNotFoundError('outbound_route', id);

    const concerns: RiskConcern[] = [];
    const affected: AffectedObject[] = [];

    const trunk = await this.repo.findTrunkById(route.sip_trunk_id, tenantId);
    if (!trunk) {
      concerns.push({ code: 'TRUNK_NOT_FOUND', severity: 'error', message: `Primary SIP trunk ${route.sip_trunk_id} not found.` });
    } else {
      affected.push({ type: 'sip_trunk', id: trunk.id, name: trunk.name, role: 'primary_trunk' });
      if (trunk.status !== 'active') {
        concerns.push({ code: 'TRUNK_INACTIVE', severity: 'error', message: `Primary SIP trunk "${trunk.name}" is ${trunk.status}. Publishing will not route calls.` });
      }
    }

    if (route.fallback_sip_trunk_id) {
      const fallback = await this.repo.findTrunkById(route.fallback_sip_trunk_id, tenantId);
      if (!fallback) {
        concerns.push({ code: 'FALLBACK_TRUNK_NOT_FOUND', severity: 'warning', message: `Fallback SIP trunk ${route.fallback_sip_trunk_id} not found.` });
      } else {
        affected.push({ type: 'sip_trunk', id: fallback.id, name: fallback.name, role: 'fallback_trunk' });
        if (fallback.status !== 'active') {
          concerns.push({ code: 'FALLBACK_TRUNK_INACTIVE', severity: 'warning', message: `Fallback SIP trunk "${fallback.name}" is ${fallback.status}.` });
        }
      }
    }

    const conflictCount = await this.repo.countActiveOutboundRoutesWithPrefix(route.match_prefix, tenantId, id);
    if (conflictCount > 0) {
      concerns.push({ code: 'PREFIX_CONFLICT', severity: 'warning', message: `${conflictCount} active route(s) already match prefix "${route.match_prefix}". Priority ordering will determine which route wins.` });
    }

    const sharedTrunkCount = trunk ? await this.repo.countActiveOutboundRoutesForTrunk(trunk.id, tenantId, id) : 0;
    if (sharedTrunkCount > 0) {
      concerns.push({ code: 'SHARED_TRUNK', severity: 'info', message: `${sharedTrunkCount} other active route(s) share the same primary trunk.` });
    }

    if (!route.max_calls_per_minute && route.match_prefix.startsWith('+') && route.match_prefix.length <= 3) {
      concerns.push({ code: 'NO_RATE_CAP_INTERNATIONAL', severity: 'warning', message: `No rate cap set on an international prefix "${route.match_prefix}". Consider adding max_calls_per_minute to limit fraud exposure.` });
    }

    const riskLevel = computeRiskLevel(concerns, affected.length);
    const errorConcerns = concerns.filter(c => c.severity === 'error');
    const summary = errorConcerns.length > 0
      ? `Route "${route.name}" has ${errorConcerns.length} blocking concern(s) that must be resolved before publishing: ${errorConcerns.map(c => c.message).join(' ')}`
      : `Route "${route.name}" (prefix "${route.match_prefix}", priority ${route.priority}) is ready to publish. ${concerns.length > 0 ? `${concerns.length} advisory concern(s) noted.` : 'No concerns found.'}`;

    return {
      target_type: 'outbound_route',
      target_id: id,
      target_name: route.name,
      target_status: route.status,
      risk_level: riskLevel,
      affected_objects: affected,
      unresolved_concerns: concerns,
      summary,
      is_advisory: true,
      analyzed_at: new Date().toISOString(),
    };
  }

  private async analyzeInboundRoute(id: string, tenantId: string): Promise<RouteRiskAnalysis> {
    const route = await this.repo.findInboundRoute(id, tenantId);
    if (!route) throw new RiskAnalysisTargetNotFoundError('inbound_route', id);

    const concerns: RiskConcern[] = [];
    const affected: AffectedObject[] = [];

    if (!route.draft_version_id) {
      concerns.push({ code: 'NO_DRAFT_VERSION', severity: 'warning', message: 'No draft version exists. Create and configure a draft before publishing.' });
    } else {
      const version = await this.repo.findRouteVersion(route.draft_version_id);
      if (version) {
        if (version.state === 'draft') {
          concerns.push({ code: 'VERSION_NOT_VALIDATED', severity: 'warning', message: `Draft version v${version.version_number} has not been validated. Run validation before publishing.` });
        } else if (version.state === 'validated') {
          concerns.push({ code: 'VERSION_NOT_SIMULATED', severity: 'info', message: `Draft version v${version.version_number} is validated but not simulated. Simulation is recommended before publishing.` });
        }
      }
    }

    const hasConflict = await this.repo.hasConflictingActiveInboundRoute(tenantId, route.match_type, route.match_value, id);
    if (hasConflict) {
      concerns.push({ code: 'ROUTE_CONFLICT', severity: 'error', message: `An active inbound route already handles ${route.match_type}="${route.match_value}". Publishing will create a routing conflict.` });
    }

    if (!route.target_id) {
      concerns.push({ code: 'NO_TARGET', severity: 'error', message: 'Route has no target configured. Set a target IVR flow, extension, queue, or voicemail box before publishing.' });
    }

    if (route.match_type === 'did' && !route.phone_number_id) {
      concerns.push({ code: 'DID_UNBOUND', severity: 'warning', message: 'DID route has no phone number bound. Calls will only match via direct dial, not through an assigned DID.' });
    }

    const riskLevel = computeRiskLevel(concerns, affected.length);
    const errorConcerns = concerns.filter(c => c.severity === 'error');
    const summary = errorConcerns.length > 0
      ? `Inbound route "${route.name}" has ${errorConcerns.length} blocking concern(s): ${errorConcerns.map(c => c.message).join(' ')}`
      : `Inbound route "${route.name}" (${route.match_type}="${route.match_value}") is ready to publish. ${concerns.length > 0 ? `${concerns.length} advisory concern(s) noted.` : 'No concerns found.'}`;

    return {
      target_type: 'inbound_route',
      target_id: id,
      target_name: route.name,
      target_status: route.status,
      risk_level: riskLevel,
      affected_objects: affected,
      unresolved_concerns: concerns,
      summary,
      is_advisory: true,
      analyzed_at: new Date().toISOString(),
    };
  }

  private async analyzeSipTrunk(id: string, tenantId: string): Promise<RouteRiskAnalysis> {
    const trunk = await this.repo.findSipTrunk(id, tenantId);
    if (!trunk) throw new RiskAnalysisTargetNotFoundError('sip_trunk', id);

    const concerns: RiskConcern[] = [];
    const affected: AffectedObject[] = [];

    const dependentRoutes = await this.repo.findDependentOutboundRoutes(id, tenantId);
    for (const r of dependentRoutes) {
      affected.push({ type: 'outbound_route', id: r.id, name: r.name, role: r.role === 'primary' ? 'primary_route' : 'fallback_route' });
    }

    const activeDependent = dependentRoutes.filter(r => r.status === 'active');
    if (trunk.status !== 'active' && activeDependent.length > 0) {
      concerns.push({ code: 'INACTIVE_TRUNK_WITH_ROUTES', severity: 'error', message: `Trunk "${trunk.name}" is ${trunk.status} but ${activeDependent.length} active outbound route(s) depend on it. Outbound calls will fail.` });
    }

    const hasPending = await this.repo.hasPendingApplyRequest(id, tenantId);
    if (hasPending) {
      concerns.push({ code: 'PENDING_APPLY', severity: 'warning', message: `Trunk "${trunk.name}" has a pending runtime apply request. Changes may not yet be reflected in FreeSWITCH.` });
    }

    if (activeDependent.length === 0 && trunk.status === 'active') {
      concerns.push({ code: 'NO_DEPENDENT_ROUTES', severity: 'info', message: `Trunk "${trunk.name}" has no active outbound routes. It will not carry outbound calls until a route is configured.` });
    }

    const riskLevel = computeRiskLevel(concerns, affected.length);
    const errorConcerns = concerns.filter(c => c.severity === 'error');
    const summary = errorConcerns.length > 0
      ? `SIP trunk "${trunk.name}" has ${errorConcerns.length} critical concern(s): ${errorConcerns.map(c => c.message).join(' ')}`
      : `SIP trunk "${trunk.name}" (${trunk.direction}, ${trunk.status}) has ${activeDependent.length} active dependent route(s). ${concerns.length > 0 ? `${concerns.length} advisory concern(s) noted.` : 'No concerns found.'}`;

    return {
      target_type: 'sip_trunk',
      target_id: id,
      target_name: trunk.name,
      target_status: trunk.status,
      risk_level: riskLevel,
      affected_objects: affected,
      unresolved_concerns: concerns,
      summary,
      is_advisory: true,
      analyzed_at: new Date().toISOString(),
    };
  }
}
