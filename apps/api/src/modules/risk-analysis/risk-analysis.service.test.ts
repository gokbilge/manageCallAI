import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RiskAnalysisRepository } from './risk-analysis.repository.js';
import {
  RouteRiskAnalysisService,
  RiskAnalysisTargetNotFoundError,
  RiskAnalysisUnsupportedTargetError,
} from './risk-analysis.service.js';

vi.mock('./risk-analysis.repository.js');

const repo = vi.mocked(new RiskAnalysisRepository({} as never));
const service = new RouteRiskAnalysisService(repo);

const activeTrunk = { id: 't-1', name: 'Carrier A', status: 'active' };
const inactiveTrunk = { id: 't-2', name: 'Carrier B', status: 'inactive' };

const activeOutboundRoute = {
  id: 'r-1', name: 'US Domestic', status: 'active',
  match_prefix: '+1', priority: 100,
  sip_trunk_id: 't-1', fallback_sip_trunk_id: null, max_calls_per_minute: 60,
};

const draftOutboundRoute = {
  ...activeOutboundRoute, id: 'r-2', name: 'International', status: 'draft',
  match_prefix: '+', max_calls_per_minute: null,
};

const activeInboundRoute = {
  id: 'ir-1', name: 'Main DID', status: 'active',
  match_type: 'did', match_value: '+15551234567',
  phone_number_id: 'pn-1', target_type: 'flow', target_id: 'flow-1',
  draft_version_id: 'v-1', active_version_id: 'v-1',
};

const sipTrunk = { id: 't-1', name: 'Carrier A', status: 'active', direction: 'outbound' };

beforeEach(() => vi.clearAllMocks());

describe('RouteRiskAnalysisService', () => {
  describe('analyze — unsupported type', () => {
    it('throws for unknown target type', async () => {
      await expect(service.analyze('unknown_type' as never, 'id', 'tenant-1'))
        .rejects.toThrow(RiskAnalysisUnsupportedTargetError);
    });
  });

  describe('outbound_route', () => {
    it('throws when route not found', async () => {
      repo.findOutboundRoute.mockResolvedValue(null);
      await expect(service.analyze('outbound_route', 'missing', 'tenant-1'))
        .rejects.toThrow(RiskAnalysisTargetNotFoundError);
    });

    it('returns low risk for healthy active route', async () => {
      repo.findOutboundRoute.mockResolvedValue(activeOutboundRoute);
      repo.findTrunkById.mockResolvedValue(activeTrunk);
      repo.countActiveOutboundRoutesWithPrefix.mockResolvedValue(0);
      repo.countActiveOutboundRoutesForTrunk.mockResolvedValue(0);

      const result = await service.analyze('outbound_route', 'r-1', 'tenant-1');
      expect(result.risk_level).toBe('low');
      expect(result.unresolved_concerns).toHaveLength(0);
      expect(result.affected_objects).toContainEqual(expect.objectContaining({ id: 't-1', role: 'primary_trunk' }));
      expect(result.is_advisory).toBe(true);
    });

    it('returns high risk when primary trunk is inactive', async () => {
      repo.findOutboundRoute.mockResolvedValue(activeOutboundRoute);
      repo.findTrunkById.mockResolvedValue(inactiveTrunk);
      repo.countActiveOutboundRoutesWithPrefix.mockResolvedValue(0);
      repo.countActiveOutboundRoutesForTrunk.mockResolvedValue(0);

      const result = await service.analyze('outbound_route', 'r-1', 'tenant-1');
      expect(result.risk_level).toBe('high');
      expect(result.unresolved_concerns).toContainEqual(expect.objectContaining({ code: 'TRUNK_INACTIVE', severity: 'error' }));
    });

    it('returns high risk when trunk not found', async () => {
      repo.findOutboundRoute.mockResolvedValue(activeOutboundRoute);
      repo.findTrunkById.mockResolvedValue(null);
      repo.countActiveOutboundRoutesWithPrefix.mockResolvedValue(0);
      repo.countActiveOutboundRoutesForTrunk.mockResolvedValue(0);

      const result = await service.analyze('outbound_route', 'r-1', 'tenant-1');
      expect(result.risk_level).toBe('high');
      expect(result.unresolved_concerns).toContainEqual(expect.objectContaining({ code: 'TRUNK_NOT_FOUND' }));
    });

    it('warns on prefix conflict with existing active routes', async () => {
      repo.findOutboundRoute.mockResolvedValue(activeOutboundRoute);
      repo.findTrunkById.mockResolvedValue(activeTrunk);
      repo.countActiveOutboundRoutesWithPrefix.mockResolvedValue(2);
      repo.countActiveOutboundRoutesForTrunk.mockResolvedValue(0);

      const result = await service.analyze('outbound_route', 'r-1', 'tenant-1');
      expect(result.risk_level).toBe('medium');
      expect(result.unresolved_concerns).toContainEqual(expect.objectContaining({ code: 'PREFIX_CONFLICT', severity: 'warning' }));
    });

    it('warns on inactive fallback trunk', async () => {
      const routeWithFallback = { ...activeOutboundRoute, fallback_sip_trunk_id: 't-2' };
      repo.findOutboundRoute.mockResolvedValue(routeWithFallback);
      repo.findTrunkById
        .mockResolvedValueOnce(activeTrunk)
        .mockResolvedValueOnce(inactiveTrunk);
      repo.countActiveOutboundRoutesWithPrefix.mockResolvedValue(0);
      repo.countActiveOutboundRoutesForTrunk.mockResolvedValue(0);

      const result = await service.analyze('outbound_route', 'r-1', 'tenant-1');
      expect(result.unresolved_concerns).toContainEqual(expect.objectContaining({ code: 'FALLBACK_TRUNK_INACTIVE', severity: 'warning' }));
      expect(result.affected_objects).toContainEqual(expect.objectContaining({ id: 't-2', role: 'fallback_trunk' }));
    });

    it('warns when no rate cap on short international prefix', async () => {
      repo.findOutboundRoute.mockResolvedValue(draftOutboundRoute);
      repo.findTrunkById.mockResolvedValue(activeTrunk);
      repo.countActiveOutboundRoutesWithPrefix.mockResolvedValue(0);
      repo.countActiveOutboundRoutesForTrunk.mockResolvedValue(0);

      const result = await service.analyze('outbound_route', 'r-2', 'tenant-1');
      expect(result.unresolved_concerns).toContainEqual(expect.objectContaining({ code: 'NO_RATE_CAP_INTERNATIONAL', severity: 'warning' }));
    });

    it('adds info concern for shared trunk with other routes', async () => {
      repo.findOutboundRoute.mockResolvedValue(activeOutboundRoute);
      repo.findTrunkById.mockResolvedValue(activeTrunk);
      repo.countActiveOutboundRoutesWithPrefix.mockResolvedValue(0);
      repo.countActiveOutboundRoutesForTrunk.mockResolvedValue(3);

      const result = await service.analyze('outbound_route', 'r-1', 'tenant-1');
      expect(result.unresolved_concerns).toContainEqual(expect.objectContaining({ code: 'SHARED_TRUNK', severity: 'info' }));
    });
  });

  describe('inbound_route', () => {
    it('throws when route not found', async () => {
      repo.findInboundRoute.mockResolvedValue(null);
      await expect(service.analyze('inbound_route', 'missing', 'tenant-1'))
        .rejects.toThrow(RiskAnalysisTargetNotFoundError);
    });

    it('returns low risk for validated route with no conflicts', async () => {
      repo.findInboundRoute.mockResolvedValue(activeInboundRoute);
      repo.findRouteVersion.mockResolvedValue({ id: 'v-1', state: 'published', version_number: 1 });
      repo.hasConflictingActiveInboundRoute.mockResolvedValue(false);

      const result = await service.analyze('inbound_route', 'ir-1', 'tenant-1');
      expect(result.risk_level).toBe('low');
      expect(result.unresolved_concerns).toHaveLength(0);
    });

    it('warns when draft version is not validated', async () => {
      repo.findInboundRoute.mockResolvedValue(activeInboundRoute);
      repo.findRouteVersion.mockResolvedValue({ id: 'v-1', state: 'draft', version_number: 2 });
      repo.hasConflictingActiveInboundRoute.mockResolvedValue(false);

      const result = await service.analyze('inbound_route', 'ir-1', 'tenant-1');
      expect(result.unresolved_concerns).toContainEqual(expect.objectContaining({ code: 'VERSION_NOT_VALIDATED', severity: 'warning' }));
    });

    it('adds info when validated but not simulated', async () => {
      repo.findInboundRoute.mockResolvedValue(activeInboundRoute);
      repo.findRouteVersion.mockResolvedValue({ id: 'v-1', state: 'validated', version_number: 2 });
      repo.hasConflictingActiveInboundRoute.mockResolvedValue(false);

      const result = await service.analyze('inbound_route', 'ir-1', 'tenant-1');
      expect(result.unresolved_concerns).toContainEqual(expect.objectContaining({ code: 'VERSION_NOT_SIMULATED', severity: 'info' }));
    });

    it('returns high risk for conflicting active route', async () => {
      repo.findInboundRoute.mockResolvedValue(activeInboundRoute);
      repo.findRouteVersion.mockResolvedValue({ id: 'v-1', state: 'published', version_number: 1 });
      repo.hasConflictingActiveInboundRoute.mockResolvedValue(true);

      const result = await service.analyze('inbound_route', 'ir-1', 'tenant-1');
      expect(result.risk_level).toBe('high');
      expect(result.unresolved_concerns).toContainEqual(expect.objectContaining({ code: 'ROUTE_CONFLICT', severity: 'error' }));
    });

    it('returns high risk when no target configured', async () => {
      const noTarget = { ...activeInboundRoute, target_id: null };
      repo.findInboundRoute.mockResolvedValue(noTarget);
      repo.findRouteVersion.mockResolvedValue({ id: 'v-1', state: 'published', version_number: 1 });
      repo.hasConflictingActiveInboundRoute.mockResolvedValue(false);

      const result = await service.analyze('inbound_route', 'ir-1', 'tenant-1');
      expect(result.unresolved_concerns).toContainEqual(expect.objectContaining({ code: 'NO_TARGET', severity: 'error' }));
    });

    it('warns for DID route with no phone number bound', async () => {
      const unboundDid = { ...activeInboundRoute, phone_number_id: null };
      repo.findInboundRoute.mockResolvedValue(unboundDid);
      repo.findRouteVersion.mockResolvedValue({ id: 'v-1', state: 'published', version_number: 1 });
      repo.hasConflictingActiveInboundRoute.mockResolvedValue(false);

      const result = await service.analyze('inbound_route', 'ir-1', 'tenant-1');
      expect(result.unresolved_concerns).toContainEqual(expect.objectContaining({ code: 'DID_UNBOUND', severity: 'warning' }));
    });

    it('warns when no draft version exists', async () => {
      const noDraft = { ...activeInboundRoute, draft_version_id: null };
      repo.findInboundRoute.mockResolvedValue(noDraft);
      repo.hasConflictingActiveInboundRoute.mockResolvedValue(false);

      const result = await service.analyze('inbound_route', 'ir-1', 'tenant-1');
      expect(result.unresolved_concerns).toContainEqual(expect.objectContaining({ code: 'NO_DRAFT_VERSION', severity: 'warning' }));
    });
  });

  describe('sip_trunk', () => {
    it('throws when trunk not found', async () => {
      repo.findSipTrunk.mockResolvedValue(null);
      await expect(service.analyze('sip_trunk', 'missing', 'tenant-1'))
        .rejects.toThrow(RiskAnalysisTargetNotFoundError);
    });

    it('returns low risk for active trunk with dependent routes', async () => {
      repo.findSipTrunk.mockResolvedValue(sipTrunk);
      repo.findDependentOutboundRoutes.mockResolvedValue([
        { id: 'r-1', name: 'US Domestic', status: 'active', role: 'primary' },
      ]);
      repo.hasPendingApplyRequest.mockResolvedValue(false);

      const result = await service.analyze('sip_trunk', 't-1', 'tenant-1');
      expect(result.risk_level).toBe('low');
      expect(result.affected_objects).toHaveLength(1);
      expect(result.affected_objects[0]).toMatchObject({ role: 'primary_route' });
    });

    it('returns high risk when inactive trunk has active routes', async () => {
      repo.findSipTrunk.mockResolvedValue({ ...sipTrunk, status: 'inactive' });
      repo.findDependentOutboundRoutes.mockResolvedValue([
        { id: 'r-1', name: 'US Domestic', status: 'active', role: 'primary' },
      ]);
      repo.hasPendingApplyRequest.mockResolvedValue(false);

      const result = await service.analyze('sip_trunk', 't-1', 'tenant-1');
      expect(result.risk_level).toBe('high');
      expect(result.unresolved_concerns).toContainEqual(expect.objectContaining({ code: 'INACTIVE_TRUNK_WITH_ROUTES', severity: 'error' }));
    });

    it('warns for pending apply request', async () => {
      repo.findSipTrunk.mockResolvedValue(sipTrunk);
      repo.findDependentOutboundRoutes.mockResolvedValue([
        { id: 'r-1', name: 'US Domestic', status: 'active', role: 'primary' },
      ]);
      repo.hasPendingApplyRequest.mockResolvedValue(true);

      const result = await service.analyze('sip_trunk', 't-1', 'tenant-1');
      expect(result.unresolved_concerns).toContainEqual(expect.objectContaining({ code: 'PENDING_APPLY', severity: 'warning' }));
    });

    it('adds info when active trunk has no routes', async () => {
      repo.findSipTrunk.mockResolvedValue(sipTrunk);
      repo.findDependentOutboundRoutes.mockResolvedValue([]);
      repo.hasPendingApplyRequest.mockResolvedValue(false);

      const result = await service.analyze('sip_trunk', 't-1', 'tenant-1');
      expect(result.unresolved_concerns).toContainEqual(expect.objectContaining({ code: 'NO_DEPENDENT_ROUTES', severity: 'info' }));
    });

    it('marks fallback role for fallback-only routes', async () => {
      repo.findSipTrunk.mockResolvedValue(sipTrunk);
      repo.findDependentOutboundRoutes.mockResolvedValue([
        { id: 'r-2', name: 'Fallback Route', status: 'active', role: 'fallback' },
      ]);
      repo.hasPendingApplyRequest.mockResolvedValue(false);

      const result = await service.analyze('sip_trunk', 't-1', 'tenant-1');
      expect(result.affected_objects[0]).toMatchObject({ role: 'fallback_route' });
    });
  });
});
