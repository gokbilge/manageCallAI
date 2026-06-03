import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RuntimeApplyService, RuntimeApplyNotFoundError } from './runtime-apply.service.js';
import type { RuntimeApplyRepository } from './runtime-apply.repository.js';
import type { RuntimeApplyRequest } from './runtime-apply.types.js';

const makeRequest = (overrides: Partial<RuntimeApplyRequest> = {}): RuntimeApplyRequest => ({
  id: 'req-1',
  tenant_id: 'tenant-1',
  triggered_by_type: 'user',
  triggered_by_id: 'user-1',
  action_type: 'sofia_profile_rescan',
  target_node_id: 'node-1',
  target_profile: 'external',
  target_gateway: 'trunk-abc',
  object_type: 'sip_trunk',
  object_id: 'trunk-abc',
  status: 'pending',
  active_call_count: null,
  applied_at: null,
  error_message: null,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

function makeRepo(overrides: Partial<RuntimeApplyRepository> = {}): RuntimeApplyRepository {
  return {
    create: vi.fn().mockResolvedValue(makeRequest()),
    findByTrunk: vi.fn().mockResolvedValue([makeRequest()]),
    findById: vi.fn().mockResolvedValue(makeRequest()),
    listPendingForNode: vi.fn().mockResolvedValue([]),
    claim: vi.fn().mockResolvedValue(makeRequest({ status: 'applying' })),
    applyResult: vi.fn().mockResolvedValue(makeRequest({ status: 'applied' })),
    listActiveNodes: vi.fn().mockResolvedValue([
      { id: 'node-1', display_name: 'FS Node 1' },
    ]),
    ...overrides,
  } as unknown as RuntimeApplyRepository;
}

describe('RuntimeApplyService', () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: RuntimeApplyService;

  beforeEach(() => {
    repo = makeRepo();
    service = new RuntimeApplyService(repo);
  });

  it('creates apply requests for all active nodes on trunk change', async () => {
    const results = await service.createForTrunkChange({
      tenantId: 'tenant-1',
      trunkId: 'trunk-abc',
      actorId: 'user-1',
      triggeredBy: 'user',
    });
    expect(results).toHaveLength(1);
    expect(vi.mocked(repo.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-1',
        action_type: 'sofia_profile_rescan',
        target_profile: 'external',
        target_gateway: 'trunk-trunk-abc',
        object_type: 'sip_trunk',
        object_id: 'trunk-abc',
      }),
    );
  });

  it('returns empty array when no active nodes exist', async () => {
    repo = makeRepo({ listActiveNodes: vi.fn().mockResolvedValue([]) });
    service = new RuntimeApplyService(repo);
    const results = await service.createForTrunkChange({
      tenantId: 'tenant-1',
      trunkId: 'trunk-abc',
      actorId: null,
      triggeredBy: 'system',
    });
    expect(results).toHaveLength(0);
    expect(vi.mocked(repo.create)).not.toHaveBeenCalled();
  });

  it('throws RuntimeApplyNotFoundError when request not found by id', async () => {
    repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
    service = new RuntimeApplyService(repo);
    await expect(service.getById('missing', 'tenant-1')).rejects.toThrow(RuntimeApplyNotFoundError);
  });

  it('throws RuntimeApplyNotFoundError when claim fails (not pending)', async () => {
    repo = makeRepo({ claim: vi.fn().mockResolvedValue(null) });
    service = new RuntimeApplyService(repo);
    await expect(service.claimForNode('req-1', 'node-1')).rejects.toThrow(RuntimeApplyNotFoundError);
  });

  it('records applied result successfully', async () => {
    const result = await service.recordResult('req-1', 'node-1', { status: 'applied' });
    expect(result.status).toBe('applied');
  });

  it('records failed result with error message', async () => {
    repo = makeRepo({
      applyResult: vi.fn().mockResolvedValue(
        makeRequest({ status: 'failed', error_message: 'ESL error' }),
      ),
    });
    service = new RuntimeApplyService(repo);
    const result = await service.recordResult('req-1', 'node-1', {
      status: 'failed',
      error_message: 'ESL error',
    });
    expect(result.status).toBe('failed');
    expect(result.error_message).toBe('ESL error');
  });

  it('isAllowedAction validates allowlist correctly', () => {
    expect(RuntimeApplyService.isAllowedAction('reloadxml')).toBe(true);
    expect(RuntimeApplyService.isAllowedAction('sofia_profile_rescan')).toBe(true);
    expect(RuntimeApplyService.isAllowedAction('arbitrary_command')).toBe(false);
    expect(RuntimeApplyService.isAllowedAction('rm -rf /')).toBe(false);
    expect(RuntimeApplyService.isAllowedAction('')).toBe(false);
  });
});
