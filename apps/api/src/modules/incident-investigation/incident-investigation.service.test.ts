import { describe, expect, it, vi } from 'vitest';
import type { IncidentInvestigationRepository } from './incident-investigation.repository.js';
import {
  IncidentInvestigationService,
  IncidentInvestigationNotFoundError,
} from './incident-investigation.service.js';
import type { IncidentInvestigation } from './incident-investigation.types.js';

const TENANT = 'tenant-1';
const INV_ID = 'inv-1';

function makeInvestigation(overrides: Partial<IncidentInvestigation> = {}): IncidentInvestigation {
  return {
    id: INV_ID,
    tenant_id: TENANT,
    question: 'Why are calls failing?',
    context: { call_ids: ['call-1'] },
    answer: 'Investigation complete.',
    citations: [],
    data_sources: ['call_events'],
    is_advisory: true,
    created_by: 'user-1',
    created_at: '2026-06-06T10:00:00Z',
    ...overrides,
  };
}

function makeRepo(overrides: Partial<IncidentInvestigationRepository> = {}): IncidentInvestigationRepository {
  return {
    create: vi.fn().mockResolvedValue(makeInvestigation()),
    listByTenant: vi.fn().mockResolvedValue([makeInvestigation()]),
    findById: vi.fn().mockResolvedValue(makeInvestigation()),
    findCallEvents: vi.fn().mockResolvedValue([
      {
        call_id: 'call-1',
        event_type: 'call.failed',
        event_time: new Date('2026-06-06T09:55:00Z'),
        source: 'freeswitch',
        payload: { reason: 'NO_ROUTE_DESTINATION' },
      },
    ]),
    findCallEventsByTimeRange: vi.fn().mockResolvedValue([]),
    findInboundRoutes: vi.fn().mockResolvedValue([]),
    findAllActiveInboundRoutes: vi.fn().mockResolvedValue([
      { id: 'route-1', name: 'Main Route', status: 'active', match_type: 'did', match_value: '+14155551234', target_type: 'flow' },
    ]),
    findGatewayStatus: vi.fn().mockResolvedValue([
      { gateway_name: 'gw-1', state: 'up', ping_time_ms: 12, updated_at: new Date() },
    ]),
    findRecentFailedCalls: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as IncidentInvestigationRepository;
}

describe('IncidentInvestigationService', () => {
  it('investigates a call failure question using call events', async () => {
    const repo = makeRepo();
    const service = new IncidentInvestigationService(repo);

    const result = await service.investigate(
      TENANT,
      'Why are calls failing?',
      { call_ids: ['call-1'] },
      'user-1',
      false,
    );

    expect(result.is_advisory).toBe(true);
    expect(repo.findCallEvents).toHaveBeenCalledWith(['call-1'], TENANT);
    expect(repo.create).toHaveBeenCalled();
  });

  it('investigates a route question gathering active routes', async () => {
    const repo = makeRepo({
      findCallEvents: vi.fn().mockResolvedValue([]),
    });
    const service = new IncidentInvestigationService(repo);

    const result = await service.investigate(
      TENANT,
      'Which inbound routes are active?',
      {},
      'user-1',
      false,
    );

    expect(result.is_advisory).toBe(true);
    expect(repo.findAllActiveInboundRoutes).toHaveBeenCalledWith(TENANT);
  });

  it('investigates a gateway question', async () => {
    const repo = makeRepo({
      findCallEvents: vi.fn().mockResolvedValue([]),
    });
    const service = new IncidentInvestigationService(repo);

    await service.investigate(
      TENANT,
      'Is the SIP gateway healthy?',
      {},
      'user-1',
      false,
    );

    expect(repo.findGatewayStatus).toHaveBeenCalledWith(TENANT);
    // Verify create was called with gateway_status in data_sources
    expect(repo.create).toHaveBeenCalledWith(
      TENANT,
      expect.any(String),
      expect.any(Object),
      expect.any(String),
      expect.any(Array),
      expect.arrayContaining(['gateway_status']),
      'user-1',
    );
  });

  it('includes recordings_allowed in data_sources when operator has recording permission', async () => {
    const repo = makeRepo();
    const service = new IncidentInvestigationService(repo);

    await service.investigate(
      TENANT,
      'What happened on this call?',
      { call_ids: ['call-1'] },
      'user-1',
      true,
    );

    expect(repo.create).toHaveBeenCalledWith(
      TENANT,
      expect.any(String),
      expect.any(Object),
      expect.any(String),
      expect.any(Array),
      expect.arrayContaining(['recordings_allowed']),
      'user-1',
    );
  });

  it('uses time range when no call ids provided', async () => {
    const repo = makeRepo({
      findCallEventsByTimeRange: vi.fn().mockResolvedValue([
        { call_id: 'call-2', event_type: 'call.failed', event_time: new Date(), source: null, payload: {} },
      ]),
    });
    const service = new IncidentInvestigationService(repo);

    await service.investigate(
      TENANT,
      'Any call failures in the last hour?',
      { time_range: { from: '2026-06-06T09:00:00Z', to: '2026-06-06T10:00:00Z' } },
      'user-1',
      false,
    );

    expect(repo.findCallEventsByTimeRange).toHaveBeenCalledWith(
      TENANT,
      '2026-06-06T09:00:00Z',
      '2026-06-06T10:00:00Z',
    );
  });

  it('lists past investigations', async () => {
    const repo = makeRepo();
    const service = new IncidentInvestigationService(repo);
    const list = await service.list(TENANT);
    expect(list.length).toBeGreaterThan(0);
  });

  it('gets an investigation by id', async () => {
    const repo = makeRepo();
    const service = new IncidentInvestigationService(repo);
    const inv = await service.getById(INV_ID, TENANT);
    expect(inv.id).toBe(INV_ID);
  });

  it('throws IncidentInvestigationNotFoundError when not found', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
    const service = new IncidentInvestigationService(repo);
    await expect(service.getById('missing', TENANT)).rejects.toBeInstanceOf(IncidentInvestigationNotFoundError);
  });

  it('handles empty result gracefully with a no-data answer', async () => {
    const repo = makeRepo({
      findCallEvents: vi.fn().mockResolvedValue([]),
      findAllActiveInboundRoutes: vi.fn().mockResolvedValue([]),
      findGatewayStatus: vi.fn().mockResolvedValue([]),
      findRecentFailedCalls: vi.fn().mockResolvedValue([]),
    });
    const service = new IncidentInvestigationService(repo);

    await service.investigate(TENANT, 'What happened?', {}, 'user-1', false);
    expect(repo.create).toHaveBeenCalledWith(
      TENANT,
      'What happened?',
      {},
      expect.stringContaining('No data found'),
      [],
      [],
      'user-1',
    );
  });
});
