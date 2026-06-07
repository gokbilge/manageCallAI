import Fastify from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockService = {
  listByTenant: vi.fn(),
  create: vi.fn(),
  getById: vi.fn(),
  update: vi.fn(),
  publish: vi.fn(),
  deactivate: vi.fn(),
  resolveRouteForNumber: vi.fn(),
};

const mockEnterpriseRoutingService = {
  runOutboundRouteCheck: vi.fn(),
};

vi.mock('../../db/client.js', () => ({
  db: {},
}));

vi.mock('../entitlement/index.js', () => ({
  EntitlementLimitExceededError: class EntitlementLimitExceededError extends Error {},
  entitlementSvc: {
    assertWithinLimit: vi.fn().mockResolvedValue(undefined),
    recordUsage: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../auth/require-capability.js', () => ({
  requireCapability: () => async (request: { user?: unknown }) => {
    request.user = { tenant_id: 'tenant-1' };
  },
}));

vi.mock('../runtime/runtime-auth.js', () => ({
  authenticateRuntime: async () => undefined,
}));

vi.mock('./outbound-route.repository.js', () => ({
  OutboundRouteRepository: class {},
}));

vi.mock('../enterprise-routing/enterprise-routing.repository.js', () => ({
  EnterpriseRoutingRepository: class {},
}));

vi.mock('./outbound-route.service.js', async () => {
  class OutboundRouteNotFoundError extends Error {}
  class OutboundRouteValidationError extends Error {}
  class OutboundRouteService {
    constructor() {
      return mockService;
    }
  }
  return {
    OutboundRouteNotFoundError,
    OutboundRouteValidationError,
    OutboundRouteService,
  };
});

vi.mock('../enterprise-routing/enterprise-routing.service.js', async () => {
  class EnterpriseRoutingTargetNotFoundError extends Error {}
  class EnterpriseRoutingService {
    constructor() {
      return mockEnterpriseRoutingService;
    }
  }
  return {
    EnterpriseRoutingTargetNotFoundError,
    EnterpriseRoutingService,
  };
});

describe('outboundRouteController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.resetModules();
  });

  async function createApp() {
    const { outboundRouteController } = await import('./outbound-route.controller.js');
    const app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    await app.register(outboundRouteController, { prefix: '/outbound-routes' });
    return app;
  }

  it('lists routes for the tenant', async () => {
    mockService.listByTenant.mockResolvedValue([{ id: 'route-1', name: 'Route 1' }]);
    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/outbound-routes',
    });

    expect(response.statusCode).toBe(200);
    expect(mockService.listByTenant).toHaveBeenCalledWith('tenant-1');
    await app.close();
  });

  it('creates a route', async () => {
    mockService.create.mockResolvedValue({ id: 'route-1', name: 'Route 1' });
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/outbound-routes',
      payload: {
        name: 'Route 1',
        match_prefix: '+1',
        sip_trunk_id: '00000000-0000-0000-0000-000000000001',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(mockService.create).toHaveBeenCalledWith(expect.objectContaining({
      tenant_id: 'tenant-1',
      name: 'Route 1',
    }));
    await app.close();
  });

  it('maps route not found errors to 404 on get by id', async () => {
    const { OutboundRouteNotFoundError } = await import('./outbound-route.service.js');
    mockService.getById.mockRejectedValue(new OutboundRouteNotFoundError('missing'));
    const app = await createApp();

    const response = await app.inject({
      method: 'GET',
      url: '/outbound-routes/00000000-0000-0000-0000-000000000010',
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('updates a route', async () => {
    mockService.update.mockResolvedValue({ id: 'route-1', name: 'Updated' });
    const app = await createApp();

    const response = await app.inject({
      method: 'PATCH',
      url: '/outbound-routes/00000000-0000-0000-0000-000000000010',
      payload: { name: 'Updated' },
    });

    expect(response.statusCode).toBe(200);
    expect(mockService.update).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000010',
      'tenant-1',
      { name: 'Updated' },
    );
    await app.close();
  });

  it('maps route validation errors to 400 on publish', async () => {
    const { OutboundRouteValidationError } = await import('./outbound-route.service.js');
    mockService.publish.mockRejectedValue(new OutboundRouteValidationError('blocked'));
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/outbound-routes/00000000-0000-0000-0000-000000000010/publish',
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('deactivates a route', async () => {
    mockService.deactivate.mockResolvedValue({ id: 'route-1', status: 'inactive' });
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/outbound-routes/00000000-0000-0000-0000-000000000010/deactivate',
    });

    expect(response.statusCode).toBe(200);
    expect(mockService.deactivate).toHaveBeenCalledWith('00000000-0000-0000-0000-000000000010', 'tenant-1');
    await app.close();
  });

  it('returns route resolution results for runtime callers', async () => {
    mockService.resolveRouteForNumber.mockResolvedValue({
      route_id: 'route-1',
      sip_trunk_id: '00000000-0000-0000-0000-000000000001',
      fallback_sip_trunk_id: null,
      match_prefix: '+1',
      priority: 100,
      allowed_destination_prefixes_json: null,
      blocked_destination_prefixes_json: null,
    });
    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/outbound-routes/resolve',
      payload: { tenant_id: 'tenant-1', dial_number: '+14155551234' },
    });

    expect(response.statusCode).toBe(200);
    expect(mockService.resolveRouteForNumber).toHaveBeenCalledWith('tenant-1', '+14155551234');
    await app.close();
  });

  it('returns enterprise check results for a route', async () => {
    mockEnterpriseRoutingService.runOutboundRouteCheck.mockResolvedValue({
      validation: {
        target_type: 'outbound_route',
        target_id: '00000000-0000-0000-0000-000000000010',
        target_name: 'International',
        validation_status: 'passed',
        blocking_issues: [],
        advisory_issues: [],
        checked_at: '2026-06-07T00:00:00.000Z',
        summary: 'ok',
      },
      simulation: {
        target_type: 'outbound_route',
        target_id: '00000000-0000-0000-0000-000000000010',
        dial_string: '+442079460123',
        site_id: null,
        site_name: null,
        schedule_id: null,
        schedule_name: null,
        call_type: null,
        matched_rule_name: null,
        policy_name: null,
        schedule_state: 'not_checked',
        outcome: 'routed_primary',
        selected_trunk_id: null,
        selected_trunk_name: null,
        steps: [],
        summary: 'ok',
        is_advisory: true,
        simulated_at: '2026-06-07T00:00:00.000Z',
      },
    });

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/outbound-routes/00000000-0000-0000-0000-000000000010/enterprise-check',
      payload: { dial_string: '+442079460123', site_id: null, schedule_id: null },
    });

    expect(response.statusCode).toBe(200);
    expect(mockEnterpriseRoutingService.runOutboundRouteCheck).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000010',
      'tenant-1',
      { dial_string: '+442079460123', site_id: null, schedule_id: null },
    );

    await app.close();
  });

  it('maps enterprise target not found errors to 404', async () => {
    const { EnterpriseRoutingTargetNotFoundError } = await import('../enterprise-routing/enterprise-routing.service.js');
    mockEnterpriseRoutingService.runOutboundRouteCheck.mockRejectedValue(
      new EnterpriseRoutingTargetNotFoundError('missing-route'),
    );

    const app = await createApp();

    const response = await app.inject({
      method: 'POST',
      url: '/outbound-routes/00000000-0000-0000-0000-000000000010/enterprise-check',
      payload: { dial_string: '+442079460123' },
    });

    expect(response.statusCode).toBe(404);

    await app.close();
  });
});
