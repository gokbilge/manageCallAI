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
  allowed_destination_prefixes_json: null,
  blocked_destination_prefixes_json: null,
  created_at: new Date(),
  updated_at: new Date(),
};

const draftRoute: OutboundRoute = { ...baseRoute, id: 'route-draft', status: 'draft' };

function makeRepo(overrides: Partial<OutboundRouteRepository> = {}): OutboundRouteRepository {
  return {
    findAllByTenant: vi.fn().mockResolvedValue([baseRoute]),
    findById: vi.fn().mockResolvedValue(baseRoute),
    create: vi.fn().mockResolvedValue(baseRoute),
    update: vi.fn().mockResolvedValue(baseRoute),
    publish: vi.fn().mockResolvedValue({ ...baseRoute, status: 'active' }),
    deactivate: vi.fn().mockResolvedValue({ ...baseRoute, status: 'inactive' }),
    findActiveTrunk: vi.fn().mockResolvedValue({ id: TRUNK_A }),
    resolveRouteForNumber: vi.fn().mockResolvedValue({
      route_id: 'route-1',
      sip_trunk_id: TRUNK_A,
      fallback_sip_trunk_id: null,
      match_prefix: '+',
      priority: 100,
      allowed_destination_prefixes_json: null,
      blocked_destination_prefixes_json: null,
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

  it('rejects invalid destination allowlist entries', async () => {
    await expect(service.create({
      tenant_id: TENANT,
      name: 'Bad',
      match_prefix: '+1',
      sip_trunk_id: TRUNK_A,
      allowed_destination_prefixes_json: ['abc'],
    })).rejects.toThrow(OutboundRouteValidationError);
  });

  it('rejects invalid destination blocklist entries', async () => {
    await expect(service.create({
      tenant_id: TENANT,
      name: 'Bad',
      match_prefix: '+1',
      sip_trunk_id: TRUNK_A,
      blocked_destination_prefixes_json: ['+1555', 'abc'],
    })).rejects.toThrow(OutboundRouteValidationError);
  });

  it('deactivates an active route', async () => {
    const result = await service.deactivate('route-1', TENANT);
    expect(result.status).toBe('inactive');
  });

  it('throws ValidationError when deactivating a non-active route', async () => {
    vi.mocked(repo.findById).mockResolvedValue(draftRoute);
    await expect(service.deactivate('route-draft', TENANT)).rejects.toThrow(OutboundRouteValidationError);
  });

  it('throws NotFoundError when deactivating missing route', async () => {
    vi.mocked(repo.findById).mockResolvedValue(null);
    await expect(service.deactivate('missing', TENANT)).rejects.toThrow(OutboundRouteNotFoundError);
  });

  it('publishes a draft route', async () => {
    vi.mocked(repo.findById).mockResolvedValue(draftRoute);
    const result = await service.publish('route-draft', TENANT);
    expect(result.status).toBe('active');
    expect(repo.publish).toHaveBeenCalledWith('route-draft', TENANT);
  });

  it('throws ValidationError when publishing a non-draft route', async () => {
    await expect(service.publish('route-1', TENANT)).rejects.toThrow(OutboundRouteValidationError);
  });

  it('throws NotFoundError when publishing missing route', async () => {
    vi.mocked(repo.findById).mockResolvedValue(null);
    await expect(service.publish('missing', TENANT)).rejects.toThrow(OutboundRouteNotFoundError);
  });

  it('creates a route as draft when start_as_draft is true', async () => {
    vi.mocked(repo.create).mockResolvedValue(draftRoute);
    const result = await service.create({
      tenant_id: TENANT, name: 'Draft Route', match_prefix: '+44', sip_trunk_id: TRUNK_A, start_as_draft: true,
    });
    expect(result.status).toBe('draft');
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ start_as_draft: true }));
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
