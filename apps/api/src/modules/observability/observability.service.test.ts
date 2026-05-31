import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ObservabilityService } from './observability.service.js';
import type { ObservabilityRepository } from './observability.repository.js';
import type { LiveSnapshot, PlatformRuntimeSummary } from './observability.types.js';

const TENANT_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const TENANT_B = 'bbbbbbbb-0000-0000-0000-000000000002';

function makeSnapshot(tenantId: string): LiveSnapshot {
  return {
    tenant_id: tenantId,
    active_session_count: 2,
    running_sessions: [
      { id: 'sess-1', call_id: 'call-1', flow_id: 'flow-1', caller_number: '+1555', current_node_id: 'menu', started_at: new Date().toISOString() },
    ],
    queue_depths: [{ queue_id: 'q-1', queue_name: 'Sales', member_count: 3 }],
    webhook_backlog: { pending: 1, processing: 0, failed: 0, abandoned: 0 },
    recent_call_events_5m: 5,
    recent_session_failures_1h: 0,
    pending_approvals: 0,
    generated_at: new Date().toISOString(),
  };
}

function makePlatformSummary(): PlatformRuntimeSummary {
  return { active_sessions: 4, completed_sessions_24h: 50, failed_sessions_24h: 1 };
}

const mockRepo = {
  getSnapshot: vi.fn(),
  getPlatformRuntimeSummary: vi.fn(),
} as unknown as ObservabilityRepository;

const service = new ObservabilityService(mockRepo);

beforeEach(() => vi.clearAllMocks());

describe('ObservabilityService.getSnapshot', () => {
  it('returns the snapshot from the repository for the given tenant', async () => {
    const snap = makeSnapshot(TENANT_A);
    vi.mocked(mockRepo.getSnapshot).mockResolvedValue(snap);

    const result = await service.getSnapshot(TENANT_A);

    expect(result.tenant_id).toBe(TENANT_A);
    expect(mockRepo.getSnapshot).toHaveBeenCalledWith(TENANT_A);
    expect(mockRepo.getSnapshot).toHaveBeenCalledOnce();
  });

  it('passes the correct tenant_id so each call is scoped to its own tenant', async () => {
    vi.mocked(mockRepo.getSnapshot).mockImplementation(
      (tenantId) => Promise.resolve(makeSnapshot(tenantId)),
    );

    const [snapA, snapB] = await Promise.all([
      service.getSnapshot(TENANT_A),
      service.getSnapshot(TENANT_B),
    ]);

    // Each result is scoped to the correct tenant — no cross-tenant leakage.
    expect(snapA.tenant_id).toBe(TENANT_A);
    expect(snapB.tenant_id).toBe(TENANT_B);
    expect(mockRepo.getSnapshot).toHaveBeenCalledTimes(2);
  });

  it('propagates repository errors to the caller', async () => {
    vi.mocked(mockRepo.getSnapshot).mockRejectedValue(new Error('db error'));
    await expect(service.getSnapshot(TENANT_A)).rejects.toThrow('db error');
  });

  it('snapshot does not contain sensitive credential fields', async () => {
    const snap = makeSnapshot(TENANT_A);
    vi.mocked(mockRepo.getSnapshot).mockResolvedValue(snap);

    const result = await service.getSnapshot(TENANT_A);
    const serialised = JSON.stringify(result);

    expect(serialised).not.toContain('password');
    expect(serialised).not.toContain('secret');
    expect(serialised).not.toContain('sip_password');
    expect(serialised).not.toContain('signing_secret');
    expect(serialised).not.toContain('storage_uri');
  });
});

describe('ObservabilityService.getPlatformHealth', () => {
  it('aggregates service health checks and platform runtime summary', async () => {
    vi.mocked(mockRepo.getPlatformRuntimeSummary).mockResolvedValue(makePlatformSummary());

    const checks = [
      { name: 'api', url: 'http://api.internal/health' },
    ];

    // Patch global fetch to return a healthy response.
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('ok', { status: 200 }),
    );

    const result = await service.getPlatformHealth(checks);

    expect(result.services).toHaveLength(1);
    expect(result.services[0]?.name).toBe('api');
    expect(result.services[0]?.status).toBe('healthy');
    expect(result.active_sessions_total).toBe(4);
    expect(result.completed_sessions_24h).toBe(50);
    expect(result.failed_sessions_24h).toBe(1);
    expect(result.generated_at).toBeDefined();

    fetchSpy.mockRestore();
  });

  it('marks a service as unreachable when fetch fails', async () => {
    vi.mocked(mockRepo.getPlatformRuntimeSummary).mockResolvedValue(makePlatformSummary());
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await service.getPlatformHealth([{ name: 'worker', url: 'http://worker/health' }]);

    expect(result.services[0]?.status).toBe('unreachable');
    fetchSpy.mockRestore();
  });

  it('marks a service as degraded when upstream returns non-200', async () => {
    vi.mocked(mockRepo.getPlatformRuntimeSummary).mockResolvedValue(makePlatformSummary());
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('bad gateway', { status: 502 }),
    );

    const result = await service.getPlatformHealth([{ name: 'freeswitch-agent', url: 'http://fsagent/health' }]);

    expect(result.services[0]?.status).toBe('degraded');
    fetchSpy.mockRestore();
  });

  it('does not include per-tenant session details', async () => {
    vi.mocked(mockRepo.getPlatformRuntimeSummary).mockResolvedValue(makePlatformSummary());
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok', { status: 200 }));

    const result = await service.getPlatformHealth([]);
    const serialised = JSON.stringify(result);

    // Platform health must not expose tenant_id, caller_number, or flow-level data.
    expect(serialised).not.toContain('tenant_id');
    expect(serialised).not.toContain('caller_number');
    expect(serialised).not.toContain('running_sessions');
    expect(serialised).not.toContain('queue_depths');

    vi.restoreAllMocks();
  });
});
