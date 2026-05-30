/**
 * Unit tests for inbound route service status transition guards and tenant
 * consistency checks. These do not require a database connection.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  InboundRouteService,
  InboundRouteNotFoundError,
  RouteVersionNotFoundError,
  RouteVersionStateError,
  RollbackNotAvailableError,
  InboundRouteInputError,
} from './inbound-route.service.js';
import type { InboundRouteRepository } from './inbound-route.repository.js';
import type { InboundRoute, InboundRouteWithVersions, RouteVersion } from './inbound-route.types.js';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const ROUTE_ID  = '00000000-0000-0000-0000-000000000010';
const FLOW_ID   = '00000000-0000-0000-0000-000000000020';
const USER_ID   = '00000000-0000-0000-0000-000000000099';
const now       = new Date();

function makeRoute(extra: Partial<InboundRoute> = {}): InboundRoute {
  return {
    id: ROUTE_ID,
    tenant_id: TENANT_ID,
    name: 'Main Route',
    match_type: 'did',
    match_value: '+14155550001',
    phone_number_id: null,
    target_type: 'flow',
    target_id: FLOW_ID,
    status: 'draft',
    draft_version_id: null,
    active_version_id: null,
    created_at: now,
    updated_at: now,
    ...extra,
  };
}

function makeRouteWithVersions(route: InboundRoute = makeRoute(), versions: RouteVersion[] = []): InboundRouteWithVersions {
  return { ...route, versions };
}

function makeVersion(state: RouteVersion['state'] = 'draft'): RouteVersion {
  return {
    id: 'v1',
    tenant_id: TENANT_ID,
    route_type: 'inbound',
    route_id: ROUTE_ID,
    version_number: 1,
    state,
    definition: { match_type: 'did', match_value: '+14155550001', target_type: 'flow', target_id: FLOW_ID },
    created_by: USER_ID,
    created_at: now,
    validated_at: state !== 'draft' ? now : null,
    published_at: state === 'published' ? now : null,
  };
}

const mockRepo = {
  findAllByTenant: vi.fn(),
  findById: vi.fn(),
  findVersionById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  createVersion: vi.fn(),
  nextVersionNumber: vi.fn(),
  storeValidationResult: vi.fn(),
  markVersionValidated: vi.fn(),
  hasConflictingActiveRoute: vi.fn(),
  targetExists: vi.fn(),
  setStatus: vi.fn(),
  publish: vi.fn(),
  rollback: vi.fn(),
  findPhoneNumberById: vi.fn(),
} as unknown as InboundRouteRepository;

const service = new InboundRouteService(mockRepo);

beforeEach(() => vi.clearAllMocks());

describe('InboundRouteService pattern match validation', () => {
  it('rejects invalid regex pattern match values on create', async () => {
    await expect(service.create({
      tenant_id: TENANT_ID,
      name: 'Bad regex',
      match_type: 'pattern',
      match_value: '(',
      phone_number_id: null,
      target_type: 'flow',
      target_id: FLOW_ID,
    })).rejects.toThrow(InboundRouteInputError);
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it('rejects nested quantified regex patterns on create', async () => {
    await expect(service.create({
      tenant_id: TENANT_ID,
      name: 'Catastrophic regex',
      match_type: 'pattern',
      match_value: '^(a+)+$',
      phone_number_id: null,
      target_type: 'flow',
      target_id: FLOW_ID,
    })).rejects.toThrow(InboundRouteInputError);
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it('rejects overlong regex patterns on update', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(makeRouteWithVersions(makeRoute({
      match_type: 'pattern',
      match_value: '^123$',
    })));
    await expect(service.update(ROUTE_ID, TENANT_ID, {
      match_value: '^' + '1'.repeat(201) + '$',
    })).rejects.toThrow(InboundRouteInputError);
    expect(mockRepo.update).not.toHaveBeenCalled();
  });
});

// ── Publish status transition ─────────────────────────────────────────────────

describe('InboundRouteService.publish', () => {
  it('throws RouteVersionNotFoundError when version does not exist', async () => {
    vi.mocked(mockRepo.findVersionById).mockResolvedValue(null);
    await expect(service.publish(ROUTE_ID, 'v1', TENANT_ID, USER_ID)).rejects.toThrow(RouteVersionNotFoundError);
  });

  it('throws RouteVersionStateError when version is not validated', async () => {
    vi.mocked(mockRepo.findVersionById).mockResolvedValue(makeVersion('draft'));
    await expect(service.publish(ROUTE_ID, 'v1', TENANT_ID, USER_ID)).rejects.toThrow(RouteVersionStateError);
  });

  it('throws RouteVersionStateError when version is already published', async () => {
    vi.mocked(mockRepo.findVersionById).mockResolvedValue(makeVersion('published'));
    await expect(service.publish(ROUTE_ID, 'v1', TENANT_ID, USER_ID)).rejects.toThrow(RouteVersionStateError);
  });

  it('calls repo.publish when version is validated', async () => {
    const route = makeRoute({ status: 'draft' });
    vi.mocked(mockRepo.findVersionById).mockResolvedValue(makeVersion('validated'));
    vi.mocked(mockRepo.publish).mockResolvedValue(route);
    const result = await service.publish(ROUTE_ID, 'v1', TENANT_ID, USER_ID);
    expect(mockRepo.publish).toHaveBeenCalledWith({
      tenant_id: TENANT_ID,
      route_id: ROUTE_ID,
      version_id: 'v1',
      triggered_by_id: USER_ID,
    });
    expect(result).toMatchObject({ id: ROUTE_ID });
  });
});

// ── Rollback ──────────────────────────────────────────────────────────────────

describe('InboundRouteService.rollback', () => {
  it('throws InboundRouteNotFoundError when route does not exist', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null);
    await expect(service.rollback(ROUTE_ID, TENANT_ID, USER_ID)).rejects.toThrow(InboundRouteNotFoundError);
  });

  it('throws RollbackNotAvailableError when repo returns null', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(makeRouteWithVersions());
    vi.mocked(mockRepo.rollback).mockResolvedValue(null);
    await expect(service.rollback(ROUTE_ID, TENANT_ID, USER_ID)).rejects.toThrow(RollbackNotAvailableError);
  });
});

// ── Activate — tenant consistency check ───────────────────────────────────────

describe('InboundRouteService.activate', () => {
  it('throws InboundRouteNotFoundError when route does not exist', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null);
    await expect(service.activate(ROUTE_ID, TENANT_ID)).rejects.toThrow(InboundRouteNotFoundError);
  });

  it('throws InboundRouteInputError when target does not exist in tenant', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(makeRouteWithVersions(makeRoute({ target_id: FLOW_ID })));
    vi.mocked(mockRepo.targetExists).mockResolvedValue(false);
    await expect(service.activate(ROUTE_ID, TENANT_ID)).rejects.toThrow(InboundRouteInputError);
    // Verify tenant_id was passed to targetExists (tenant consistency)
    expect(mockRepo.targetExists).toHaveBeenCalledWith('flow', FLOW_ID, TENANT_ID);
  });

  it('throws InboundRouteInputError when conflicting active route exists', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(makeRouteWithVersions(makeRoute({ target_id: FLOW_ID })));
    vi.mocked(mockRepo.targetExists).mockResolvedValue(true);
    vi.mocked(mockRepo.hasConflictingActiveRoute).mockResolvedValue(true);
    await expect(service.activate(ROUTE_ID, TENANT_ID)).rejects.toThrow(InboundRouteInputError);
    // Verify tenant_id was passed (tenant consistency)
    expect(mockRepo.hasConflictingActiveRoute).toHaveBeenCalledWith(TENANT_ID, 'did', '+14155550001', ROUTE_ID);
  });

  it('activates route when all checks pass', async () => {
    const activeRoute = makeRoute({ status: 'active' });
    vi.mocked(mockRepo.findById).mockResolvedValue(makeRouteWithVersions(makeRoute({ target_id: FLOW_ID })));
    vi.mocked(mockRepo.targetExists).mockResolvedValue(true);
    vi.mocked(mockRepo.hasConflictingActiveRoute).mockResolvedValue(false);
    vi.mocked(mockRepo.setStatus).mockResolvedValue(activeRoute);
    const result = await service.activate(ROUTE_ID, TENANT_ID);
    expect(result.status).toBe('active');
  });

  it('throws InboundRouteInputError when route has no target_id', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(makeRouteWithVersions(makeRoute({ target_id: null })));
    await expect(service.activate(ROUTE_ID, TENANT_ID)).rejects.toThrow(InboundRouteInputError);
  });
});
