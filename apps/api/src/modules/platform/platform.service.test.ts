import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlatformService } from './platform.service.js';
import type { PlatformRepository } from './platform.repository.js';
import type { PlatformRuntimeSummary, TenantSummary } from './platform.types.js';

vi.mock('../../config/env.js', () => ({
  config: {
    platformApiHealthUrl: 'http://localhost:3000/health',
    platformWorkerHealthUrl: 'http://localhost:3001/health',
    platformFreeswitchAgentHealthUrl: 'http://localhost:3002/health',
  },
}));

function makeMockRepo(): PlatformRepository {
  return {
    listTenants: vi.fn(),
    getRuntimeSummary: vi.fn(),
  } as unknown as PlatformRepository;
}

function makeTenantSummary(id = 'tenant-1'): TenantSummary {
  return {
    id,
    name: 'Acme Corp',
    slug: 'acme-corp',
    directory_domain: 'acme.example.com',
    status: 'active',
    created_at: new Date(),
    updated_at: new Date(),
  };
}

function makeRuntimeSummary(): PlatformRuntimeSummary {
  return {
    active_sessions: 2,
    completed_sessions_24h: 10,
    failed_sessions_24h: 0,
    call_events_24h: 50,
    failed_runtime_ingestions_24h: 0,
    pending_approvals: 1,
  };
}

describe('PlatformService', () => {
  let repo: PlatformRepository;
  let service: PlatformService;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    repo = makeMockRepo();
    service = new PlatformService(repo);
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('listTenants', () => {
    it('delegates to repo', async () => {
      const tenants = [makeTenantSummary()];
      vi.mocked(repo.listTenants).mockResolvedValue(tenants);
      expect(await service.listTenants()).toBe(tenants);
    });
  });

  describe('runtimeSummary', () => {
    it('delegates to repo', async () => {
      const summary = makeRuntimeSummary();
      vi.mocked(repo.getRuntimeSummary).mockResolvedValue(summary);
      expect(await service.runtimeSummary()).toBe(summary);
    });
  });

  describe('runtimeHealth', () => {
    it('marks services healthy when they respond with 2xx', async () => {
      fetchSpy.mockImplementation(() => Promise.resolve(new Response('{"status":"ok"}', { status: 200 })));

      const result = await service.runtimeHealth();

      expect(result.services).toHaveLength(3);
      expect(result.services.every((s) => s.status === 'healthy')).toBe(true);
    });

    it('marks service degraded when it responds with non-2xx', async () => {
      fetchSpy.mockImplementation(() => Promise.resolve(new Response('Service Unavailable', { status: 503 })));

      const result = await service.runtimeHealth();

      expect(result.services.every((s) => s.status === 'degraded')).toBe(true);
    });

    it('marks service unreachable when fetch throws (connection refused)', async () => {
      fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await service.runtimeHealth();

      expect(result.services.every((s) => s.status === 'unreachable')).toBe(true);
      expect(result.services[0]!.detail).toBe('connection failed');
    });

    it('includes correct service names in result', async () => {
      fetchSpy.mockImplementation(() => Promise.resolve(new Response('ok', { status: 200 })));

      const result = await service.runtimeHealth();
      const names = result.services.map((s) => s.name);

      expect(names).toContain('api');
      expect(names).toContain('worker');
      expect(names).toContain('freeswitch-agent');
    });

    it('marks service unreachable when fetch is aborted by timeout', async () => {
      fetchSpy.mockRejectedValue(Object.assign(new Error('AbortError'), { name: 'AbortError' }));

      const result = await service.runtimeHealth();

      expect(result.services.every((s) => s.status === 'unreachable')).toBe(true);
    });

    it('truncates detail to 200 characters', async () => {
      const longBody = 'x'.repeat(300);
      fetchSpy.mockImplementation(() => Promise.resolve(new Response(longBody, { status: 200 })));

      const result = await service.runtimeHealth();

      expect(result.services[0]!.detail.length).toBeLessThanOrEqual(200);
    });

    it('handles mix of healthy and unreachable services', async () => {
      fetchSpy
        .mockResolvedValueOnce(new Response('ok', { status: 200 }))
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce(new Response('ok', { status: 200 }));

      const result = await service.runtimeHealth();

      const statuses = result.services.map((s) => s.status);
      expect(statuses).toContain('healthy');
      expect(statuses).toContain('unreachable');
    });
  });
});
