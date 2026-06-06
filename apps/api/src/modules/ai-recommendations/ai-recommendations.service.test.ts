import { describe, expect, it, vi } from 'vitest';
import type { AiRecommendationRepository } from './ai-recommendations.repository.js';
import {
  AiRecommendationService,
  AiRecommendationNotFoundError,
  AiRecommendationStateError,
} from './ai-recommendations.service.js';
import type { AiRecommendation, InboundRouteRow, TenantPolicyRow } from './ai-recommendations.types.js';

const TENANT = 'tenant-1';
const ROUTE_ID = 'route-1';
const REC_ID = 'rec-1';

const routeRow: InboundRouteRow = {
  id: ROUTE_ID,
  name: 'Sales Route',
  status: 'active',
  match_type: 'did',
  match_value: '+14155551234',
  phone_number_id: null,
  target_type: 'extension',
  target_id: 'ext-1',
  draft_version_id: null,
  active_version_id: 'ver-1',
};

const policyRow: TenantPolicyRow = {
  country_allowlist: ['US'],
  areacode_allowlist: [],
  premium_rate_blocklist: [],
  high_risk_blocklist: [],
  max_calls_per_hour: null,
  max_calls_per_day: null,
  max_call_duration_secs: null,
  deny_international_default: false,
};

function makeRec(overrides: Partial<AiRecommendation> = {}): AiRecommendation {
  return {
    id: REC_ID,
    tenant_id: TENANT,
    target_type: 'inbound_route',
    target_id: ROUTE_ID,
    intent: 'Route to queue',
    status: 'pending',
    recommendation: null,
    risk_level: null,
    rationale: null,
    blast_radius: null,
    accepted_at: null,
    rejected_at: null,
    decided_by: null,
    metadata: {},
    created_at: '2026-06-06T10:00:00Z',
    ...overrides,
  };
}

function makeRepo(overrides: Partial<AiRecommendationRepository> = {}): AiRecommendationRepository {
  const rec = makeRec();
  const fullRec = makeRec({
    recommendation: {
      type: 'inbound_route',
      suggested_changes: { target_type: 'queue' },
      affected_numbers: ['+14155551234'],
      affected_routes: [{ id: ROUTE_ID, name: 'Sales Route', status: 'active', role: 'target' }],
    },
    risk_level: 'low',
    rationale: 'test rationale',
    blast_radius: '1 phone number(s)',
  });

  return {
    create: vi.fn().mockResolvedValue(rec),
    update: vi.fn().mockResolvedValue(fullRec),
    listByTenant: vi.fn().mockResolvedValue([fullRec]),
    findById: vi.fn().mockResolvedValue(fullRec),
    accept: vi.fn().mockResolvedValue({ ...fullRec, status: 'accepted', accepted_at: '2026-06-06T10:05:00Z' }),
    reject: vi.fn().mockResolvedValue({ ...fullRec, status: 'rejected', rejected_at: '2026-06-06T10:05:00Z' }),
    findInboundRoute: vi.fn().mockResolvedValue(routeRow),
    findOutboundRoute: vi.fn().mockResolvedValue(null),
    findPhoneNumbersForRoute: vi.fn().mockResolvedValue([{ id: 'pn-1', number: '+14155551234', status: 'active' }]),
    findActiveInboundRoutes: vi.fn().mockResolvedValue([]),
    findTenantOutboundPolicy: vi.fn().mockResolvedValue(policyRow),
    createInboundRouteVersion: vi.fn().mockResolvedValue('ver-2'),
    updateTenantOutboundPolicy: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as AiRecommendationRepository;
}

describe('AiRecommendationService', () => {
  it('creates an inbound route recommendation from intent', async () => {
    const repo = makeRepo();
    const service = new AiRecommendationService(repo);

    const rec = await service.create(TENANT, {
      target_type: 'inbound_route',
      target_id: ROUTE_ID,
      intent: 'Route to queue for sales',
    });

    expect(rec.recommendation).toBeDefined();
    expect(repo.create).toHaveBeenCalledWith(TENANT, expect.objectContaining({ target_type: 'inbound_route' }));
    expect(repo.update).toHaveBeenCalled();
  });

  it('creates a fraud policy recommendation from intent', async () => {
    const fraudRec = makeRec({
      target_type: 'fraud_policy',
      target_id: null,
      recommendation: {
        type: 'fraud_policy',
        suggested_changes: { max_calls_per_hour: 50 },
      },
      risk_level: 'medium',
    });
    const repo = makeRepo({
      create: vi.fn().mockResolvedValue({ ...makeRec(), target_type: 'fraud_policy', target_id: null }),
      update: vi.fn().mockResolvedValue(fraudRec),
      findById: vi.fn().mockResolvedValue(fraudRec),
    });
    const service = new AiRecommendationService(repo);

    const rec = await service.create(TENANT, {
      target_type: 'fraud_policy',
      intent: 'Limit to 50 calls per hour',
    });

    expect(rec.target_type).toBe('fraud_policy');
    expect(repo.findTenantOutboundPolicy).toHaveBeenCalledWith(TENANT);
  });

  it('lists recommendations', async () => {
    const repo = makeRepo();
    const service = new AiRecommendationService(repo);
    const list = await service.list(TENANT);
    expect(list.length).toBeGreaterThan(0);
  });

  it('gets a recommendation by id', async () => {
    const repo = makeRepo();
    const service = new AiRecommendationService(repo);
    const rec = await service.getById(REC_ID, TENANT);
    expect(rec.id).toBe(REC_ID);
  });

  it('throws AiRecommendationNotFoundError when not found', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
    const service = new AiRecommendationService(repo);
    await expect(service.getById('missing', TENANT)).rejects.toBeInstanceOf(AiRecommendationNotFoundError);
  });

  it('accepts a route recommendation and creates a draft version', async () => {
    const repo = makeRepo();
    const service = new AiRecommendationService(repo);

    const result = await service.accept(REC_ID, TENANT, 'user-1', 'user-1');

    expect(result.recommendation.status).toBe('accepted');
    expect(result.draft_version_id).toBe('ver-2');
    expect(repo.createInboundRouteVersion).toHaveBeenCalled();
    expect(repo.accept).toHaveBeenCalledWith(REC_ID, TENANT, 'user-1');
  });

  it('accepts a fraud policy recommendation and updates policy', async () => {
    const fraudRec = makeRec({
      target_type: 'fraud_policy',
      target_id: null,
      recommendation: {
        type: 'fraud_policy',
        suggested_changes: { max_calls_per_hour: 50 },
      },
      risk_level: 'medium',
    });
    const repo = makeRepo({
      findById: vi.fn().mockResolvedValue(fraudRec),
      accept: vi.fn().mockResolvedValue({ ...fraudRec, status: 'accepted' }),
    });
    const service = new AiRecommendationService(repo);

    const result = await service.accept(REC_ID, TENANT, 'user-1', 'user-1');

    expect(result.recommendation.status).toBe('accepted');
    expect(repo.updateTenantOutboundPolicy).toHaveBeenCalledWith(TENANT, { max_calls_per_hour: 50 });
    expect(result.draft_version_id).toBeUndefined();
  });

  it('throws AiRecommendationStateError when accepting an already-accepted recommendation', async () => {
    const repo = makeRepo({
      findById: vi.fn().mockResolvedValue(makeRec({ status: 'accepted' })),
    });
    const service = new AiRecommendationService(repo);
    await expect(service.accept(REC_ID, TENANT, 'user-1', 'user-1')).rejects.toBeInstanceOf(AiRecommendationStateError);
  });

  it('rejects a recommendation without applying changes', async () => {
    const repo = makeRepo();
    const service = new AiRecommendationService(repo);
    const result = await service.reject(REC_ID, TENANT, 'user-1');
    expect(result.status).toBe('rejected');
    expect(repo.createInboundRouteVersion).not.toHaveBeenCalled();
    expect(repo.updateTenantOutboundPolicy).not.toHaveBeenCalled();
  });

  it('throws AiRecommendationStateError when rejecting an already-rejected recommendation', async () => {
    const repo = makeRepo({
      findById: vi.fn().mockResolvedValue(makeRec({ status: 'rejected' })),
    });
    const service = new AiRecommendationService(repo);
    await expect(service.reject(REC_ID, TENANT, 'user-1')).rejects.toBeInstanceOf(AiRecommendationStateError);
  });
});
