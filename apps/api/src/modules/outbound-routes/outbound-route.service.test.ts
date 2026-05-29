import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OutboundRouteService, OutboundRouteNotFoundError, OutboundRouteValidationError } from './outbound-route.service.js';
import type { OutboundRouteRepository } from './outbound-route.repository.js';
import type { OutboundRoute } from './outbound-route.types.js';

const TENANT = 'tenant-1';
const TRUNK_A = '00000000-0000-0000-0000-000000000001';
const TRUNK_B = '00000000-0000-0000-0000-000000000002';

const baseRoute: OutboundRoute = {
  id: 'route-1',
  tenant_id: TENANT,
  name: 'International',
  status: 'active',
  match_prefix: '+',
  priority: 100,
  sip_trunk_id: TRUNK_A,
  fallback_sip_trunk_id: null,
  max_calls_per_minute: null,
  allowed_caller_id_numbers_json: null,
  created_at: new Date(),
  updated_at: new Date(),
};

function makeRepo(overrides: Partial<OutboundRouteRepository> = {}): OutboundRouteRepository {
  return {
    findAllByTenant: vi.fn().mockResolvedValue([baseRoute]),
    findById: vi.fn().mockResolvedValue(baseRoute),
    create: vi.fn().mockResolvedValue(baseRoute),
    update: vi.fn().mockResolvedValue(baseRoute),
    deactivate: vi.fn().mockResolvedValue({ ...baseRoute, status: 'inactive' }),
    findActiveTrunk: vi.fn().mockResolvedValue({ id: TRUNK_A }),
    resolveRouteForNumber: vi.fn().mockResolvedValue({
      route_id: 'route-1', sip_trunk_id: TRUNK_A, fallback_sip_trunk_id: null, match_prefix: '+', priority: 100,
    }),
    ...overrides,
  } as unknown as OutboundRouteRepository;
}

describe('OutboundRouteService', () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: OutboundRouteService;

  beforeEach(() => {
    repo = makeRepo();
    service = new OutboundRouteService(repo);
  });

  it('lists routes by tenant', async () => {
    const result = await service.listByTenant(TENANT);
    expect(result).toEqual([baseRoute]);
  });

  it('gets route by id', async () => {
    const result = await service.getById('route-1', TENANT);
    expect(result).toEqual(baseRoute);
  });

  it('throws NotFoundError when route missing', async () => {
    vi.mocked(repo.findById).mockResolvedValue(null);
    await expect(service.getById('missing', TENANT)).rejects.toThrow(OutboundRouteNotFoundError);
  });

  it('creates a route with valid inputs', async () => {
    const result = await service.create({ tenant_id: TENANT, name: 'Route', match_prefix: '+1', sip_trunk_id: TRUNK_A });
    expect(result).toEqual(baseRoute);
    expect(repo.create).toHaveBeenCalled();
  });

  it('rejects invalid match_prefix (letters)', async () => {
    await expect(service.create({ tenant_id: TENANT, name: 'Bad', match_prefix: 'abc', sip_trunk_id: TRUNK_A }))
      .rejects.toThrow(OutboundRouteValidationError);
  });

  it('rejects empty match_prefix', async () => {
    await expect(service.create({ tenant_id: TENANT, name: 'Bad', match_prefix: '', sip_trunk_id: TRUNK_A }))
      .rejects.toThrow(OutboundRouteValidationError);
  });

  it('rejects inactive trunk', async () => {
    vi.mocked(repo.findActiveTrunk).mockResolvedValue(null);
    await expect(service.create({ tenant_id: TENANT, name: 'Bad', match_prefix: '+1', sip_trunk_id: TRUNK_A }))
      .rejects.toThrow(OutboundRouteValidationError);
  });

  it('rejects fallback_sip_trunk_id equal to primary', async () => {
    await expect(service.create({
      tenant_id: TENANT, name: 'Bad', match_prefix: '+1', sip_trunk_id: TRUNK_A, fallback_sip_trunk_id: TRUNK_A,
    })).rejects.toThrow(OutboundRouteValidationError);
  });

  it('validates fallback trunk when provided', async () => {
    vi.mocked(repo.findActiveTrunk)
      .mockResolvedValueOnce({ id: TRUNK_A })
      .mockResolvedValueOnce(null);
    await expect(service.create({
      tenant_id: TENANT, name: 'Bad', match_prefix: '+1', sip_trunk_id: TRUNK_A, fallback_sip_trunk_id: TRUNK_B,
    })).rejects.toThrow(OutboundRouteValidationError);
  });

  it('rejects max_calls_per_minute out of range', async () => {
    await expect(service.create({
      tenant_id: TENANT, name: 'Bad', match_prefix: '+1', sip_trunk_id: TRUNK_A, max_calls_per_minute: 99999,
    })).rejects.toThrow(OutboundRouteValidationError);
  });

  it('rejects invalid caller ID list entries', async () => {
    await expect(service.create({
      tenant_id: TENANT, name: 'Bad', match_prefix: '+1', sip_trunk_id: TRUNK_A,
      allowed_caller_id_numbers_json: ['not-a-number'],
    })).rejects.toThrow(OutboundRouteValidationError);
  });

  it('deactivates a route', async () => {
    const result = await service.deactivate('route-1', TENANT);
    expect(result.status).toBe('inactive');
  });

  it('throws NotFoundError when deactivating missing route', async () => {
    vi.mocked(repo.deactivate).mockResolvedValue(null);
    await expect(service.deactivate('missing', TENANT)).rejects.toThrow(OutboundRouteNotFoundError);
  });

  it('resolves a route for a dial number', async () => {
    const result = await service.resolveRouteForNumber(TENANT, '+14155551234');
    expect(result).not.toBeNull();
    expect(result?.sip_trunk_id).toBe(TRUNK_A);
  });

  it('returns null when no route matches', async () => {
    vi.mocked(repo.resolveRouteForNumber).mockResolvedValue(null);
    const result = await service.resolveRouteForNumber(TENANT, '+9999999');
    expect(result).toBeNull();
  });
});
