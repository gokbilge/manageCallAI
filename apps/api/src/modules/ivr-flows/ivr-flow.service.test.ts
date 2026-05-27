import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  IvrFlowService,
  IvrFlowNotFoundError,
  FlowVersionNotFoundError,
  FlowVersionStateError,
  RollbackNotAvailableError,
} from './ivr-flow.service.js';
import type { IvrFlowRepository } from './ivr-flow.repository.js';
import type { ApprovalRequestRecord, FlowVersion, IvrFlow, IvrFlowWithVersions } from './ivr-flow.types.js';
import { defaultIvrGraph } from './ivr-flow.validation.js';

// ── Fixtures ────────────────────────────────────────────────────────────────

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const FLOW_ID   = '00000000-0000-0000-0000-000000000010';
const USER_ID   = '00000000-0000-0000-0000-000000000099';
const EXT_ID    = '00000000-0000-0000-0000-000000000050';
const PROMPT_ID = '00000000-0000-0000-0000-000000000060';

const now = new Date();

function makeVersion(
  id: string,
  state: FlowVersion['state'],
  extra: Partial<FlowVersion> = {},
): FlowVersion {
  return {
    id,
    tenant_id: TENANT_ID,
    flow_id: FLOW_ID,
    version_number: 1,
    state,
    graph_json: defaultIvrGraph(),
    created_by: null,
    created_at: now,
    validated_at: null,
    simulated_at: null,
    published_at: null,
    ...extra,
  };
}

function makeFlow(extra: Partial<IvrFlowWithVersions> = {}): IvrFlowWithVersions {
  return {
    id: FLOW_ID,
    tenant_id: TENANT_ID,
    name: 'Test Flow',
    description: null,
    status: 'draft',
    draft_version_id: null,
    active_version_id: null,
    created_at: now,
    updated_at: now,
    versions: [],
    ...extra,
  };
}

function makeApproval(): ApprovalRequestRecord {
  return {
    id: 'approval-1',
    tenant_id: TENANT_ID,
    object_type: 'ivr_flow',
    object_id: FLOW_ID,
    version_id: 'v1',
    requested_by: USER_ID,
    status: 'pending',
    created_at: now,
  };
}

// ── Mock repository ─────────────────────────────────────────────────────────

const mockRepo = {
  findAllByTenant: vi.fn(),
  findById: vi.fn(),
  findVersionById: vi.fn(),
  findVersionsByFlowId: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  createVersion: vi.fn(),
  updateVersionDefinition: vi.fn(),
  markVersionValidated: vi.fn(),
  markVersionSimulated: vi.fn(),
  storeValidationResult: vi.fn(),
  storeSimulationResult: vi.fn(),
  getActivePublishPolicy: vi.fn(),
  createApprovalRequest: vi.fn(),
  storePendingPublishRecord: vi.fn(),
  publish: vi.fn(),
  rollback: vi.fn(),
  nextVersionNumber: vi.fn(),
  findActiveExtensionIds: vi.fn(),
  findActivePromptRefs: vi.fn(),
} as unknown as IvrFlowRepository;

const service = new IvrFlowService(mockRepo);

beforeEach(() => vi.clearAllMocks());

// ── validate ────────────────────────────────────────────────────────────────

describe('IvrFlowService.validate', () => {
  it('throws FlowVersionNotFoundError when version is missing', async () => {
    vi.mocked(mockRepo.findVersionById).mockResolvedValue(null);
    await expect(service.validate(FLOW_ID, 'v1', TENANT_ID)).rejects.toThrow(FlowVersionNotFoundError);
  });

  it('passes when graph has no transfer_extension nodes', async () => {
    const version = makeVersion('v1', 'draft');
    vi.mocked(mockRepo.findVersionById).mockResolvedValue(version);
    vi.mocked(mockRepo.storeValidationResult).mockResolvedValue(undefined);
    vi.mocked(mockRepo.markVersionValidated).mockResolvedValue({ ...version, state: 'validated' });
    vi.mocked(mockRepo.findActiveExtensionIds).mockResolvedValue(new Set());
    vi.mocked(mockRepo.findActivePromptRefs).mockResolvedValue(new Map());

    const result = await service.validate(FLOW_ID, 'v1', TENANT_ID);
    expect(result.outcome.status).toBe('passed');
    expect(mockRepo.markVersionValidated).toHaveBeenCalledOnce();
  });

  it('fails when transfer_extension.extension_id is not an active extension', async () => {
    const graph = {
      entry_node_id: 'start',
      nodes: [
        { id: 'start', type: 'start', next_node_id: 'transfer' },
        { id: 'transfer', type: 'transfer_extension', extension_id: EXT_ID },
      ],
    };
    const version = makeVersion('v1', 'draft', { graph_json: graph });
    vi.mocked(mockRepo.findVersionById).mockResolvedValue(version);
    vi.mocked(mockRepo.storeValidationResult).mockResolvedValue(undefined);
    vi.mocked(mockRepo.findActiveExtensionIds).mockResolvedValue(new Set()); // extension not active
    vi.mocked(mockRepo.findActivePromptRefs).mockResolvedValue(new Map());

    const result = await service.validate(FLOW_ID, 'v1', TENANT_ID);
    expect(result.outcome.status).toBe('failed');
    expect(result.outcome.errors.some((e) => e.message.includes(EXT_ID))).toBe(true);
    expect(mockRepo.markVersionValidated).not.toHaveBeenCalled();
  });

  it('passes when transfer_extension.extension_id resolves to an active extension', async () => {
    const graph = {
      entry_node_id: 'start',
      nodes: [
        { id: 'start', type: 'start', next_node_id: 'transfer' },
        { id: 'transfer', type: 'transfer_extension', extension_id: EXT_ID },
      ],
    };
    const version = makeVersion('v1', 'draft', { graph_json: graph });
    vi.mocked(mockRepo.findVersionById).mockResolvedValue(version);
    vi.mocked(mockRepo.storeValidationResult).mockResolvedValue(undefined);
    vi.mocked(mockRepo.findActiveExtensionIds).mockResolvedValue(new Set([EXT_ID]));
    vi.mocked(mockRepo.findActivePromptRefs).mockResolvedValue(new Map());
    vi.mocked(mockRepo.markVersionValidated).mockResolvedValue({ ...version, state: 'validated' });

    const result = await service.validate(FLOW_ID, 'v1', TENANT_ID);
    expect(result.outcome.status).toBe('passed');
    expect(mockRepo.markVersionValidated).toHaveBeenCalledOnce();
  });

  it('fails when play_prompt.prompt_id does not resolve to an active prompt asset', async () => {
    const graph = {
      entry_node_id: 'start',
      nodes: [
        { id: 'start', type: 'start', next_node_id: 'prompt' },
        { id: 'prompt', type: 'play_prompt', prompt_id: PROMPT_ID, next_node_id: 'end' },
        { id: 'end', type: 'hangup' },
      ],
    };
    const version = makeVersion('v1', 'draft', { graph_json: graph });
    vi.mocked(mockRepo.findVersionById).mockResolvedValue(version);
    vi.mocked(mockRepo.storeValidationResult).mockResolvedValue(undefined);
    vi.mocked(mockRepo.findActiveExtensionIds).mockResolvedValue(new Set());
    vi.mocked(mockRepo.findActivePromptRefs).mockResolvedValue(new Map());

    const result = await service.validate(FLOW_ID, 'v1', TENANT_ID);
    expect(result.outcome.status).toBe('failed');
    expect(result.outcome.errors.some((e) => e.message.includes(PROMPT_ID))).toBe(true);
  });

  it('fails when play_collect.prompt_id has no runtime storage_uri', async () => {
    const graph = {
      entry_node_id: 'start',
      nodes: [
        { id: 'start', type: 'start', next_node_id: 'prompt' },
        { id: 'prompt', type: 'play_collect', prompt_id: PROMPT_ID, next_node_id: 'end', invalid_node_id: 'end' },
        { id: 'end', type: 'hangup' },
      ],
    };
    const version = makeVersion('v1', 'draft', { graph_json: graph });
    vi.mocked(mockRepo.findVersionById).mockResolvedValue(version);
    vi.mocked(mockRepo.storeValidationResult).mockResolvedValue(undefined);
    vi.mocked(mockRepo.findActiveExtensionIds).mockResolvedValue(new Set());
    vi.mocked(mockRepo.findActivePromptRefs).mockResolvedValue(
      new Map([[PROMPT_ID, { id: PROMPT_ID, name: 'welcome', storage_uri: null }]]),
    );

    const result = await service.validate(FLOW_ID, 'v1', TENANT_ID);
    expect(result.outcome.status).toBe('failed');
    expect(result.outcome.errors.some((e) => e.message.includes('storage_uri'))).toBe(true);
  });

  it('passes when prompt nodes resolve to active prompt assets with runtime URIs', async () => {
    const graph = {
      entry_node_id: 'start',
      nodes: [
        { id: 'start', type: 'start', next_node_id: 'prompt' },
        { id: 'prompt', type: 'play_prompt', prompt_id: PROMPT_ID, next_node_id: 'end' },
        { id: 'end', type: 'hangup' },
      ],
    };
    const version = makeVersion('v1', 'draft', { graph_json: graph });
    vi.mocked(mockRepo.findVersionById).mockResolvedValue(version);
    vi.mocked(mockRepo.storeValidationResult).mockResolvedValue(undefined);
    vi.mocked(mockRepo.findActiveExtensionIds).mockResolvedValue(new Set());
    vi.mocked(mockRepo.findActivePromptRefs).mockResolvedValue(
      new Map([[PROMPT_ID, { id: PROMPT_ID, name: 'welcome', storage_uri: '/sounds/acme/welcome.wav' }]]),
    );
    vi.mocked(mockRepo.markVersionValidated).mockResolvedValue({ ...version, state: 'validated' });

    const result = await service.validate(FLOW_ID, 'v1', TENANT_ID);
    expect(result.outcome.status).toBe('passed');
  });
});

// ── publish ─────────────────────────────────────────────────────────────────

describe('IvrFlowService.publish', () => {
  it('throws FlowVersionNotFoundError when version is missing', async () => {
    vi.mocked(mockRepo.findVersionById).mockResolvedValue(null);
    await expect(service.publish(FLOW_ID, 'v1', TENANT_ID, USER_ID)).rejects.toThrow(FlowVersionNotFoundError);
  });

  it('throws FlowVersionStateError when version is in draft state', async () => {
    vi.mocked(mockRepo.findVersionById).mockResolvedValue(makeVersion('v1', 'draft'));
    await expect(service.publish(FLOW_ID, 'v1', TENANT_ID, USER_ID)).rejects.toThrow(FlowVersionStateError);
  });

  it('throws FlowVersionStateError when version is already published', async () => {
    vi.mocked(mockRepo.findVersionById).mockResolvedValue(makeVersion('v1', 'published'));
    await expect(service.publish(FLOW_ID, 'v1', TENANT_ID, USER_ID)).rejects.toThrow(FlowVersionStateError);
  });

  it('publishes directly when no approval policy is active', async () => {
    const version = makeVersion('v1', 'validated');
    const flow: IvrFlow = { ...makeFlow(), status: 'active', active_version_id: 'v1' };
    vi.mocked(mockRepo.findVersionById).mockResolvedValue(version);
    vi.mocked(mockRepo.getActivePublishPolicy).mockResolvedValue(null);
    vi.mocked(mockRepo.publish).mockResolvedValue(flow);

    const result = await service.publish(FLOW_ID, 'v1', TENANT_ID, USER_ID);
    expect(result.status).toBe('published');
    expect(result.flow.status).toBe('active');
    expect(mockRepo.createApprovalRequest).not.toHaveBeenCalled();
  });

  it('publishes directly when policy requires approval but actor is platform_admin', async () => {
    const version = makeVersion('v1', 'simulated');
    const flow: IvrFlow = { ...makeFlow(), status: 'active', active_version_id: 'v1' };
    vi.mocked(mockRepo.findVersionById).mockResolvedValue(version);
    vi.mocked(mockRepo.getActivePublishPolicy).mockResolvedValue({ require_approval: true });
    vi.mocked(mockRepo.publish).mockResolvedValue(flow);

    const result = await service.publish(FLOW_ID, 'v1', TENANT_ID, USER_ID, 'platform_admin');
    expect(result.status).toBe('published');
    expect(mockRepo.createApprovalRequest).not.toHaveBeenCalled();
  });

  it('creates approval request when policy requires approval and actor is tenant_admin', async () => {
    const version = makeVersion('v1', 'validated');
    const approval = makeApproval();
    const flowWithVersions = makeFlow({ versions: [version] });
    vi.mocked(mockRepo.findVersionById).mockResolvedValue(version);
    vi.mocked(mockRepo.getActivePublishPolicy).mockResolvedValue({ require_approval: true });
    vi.mocked(mockRepo.createApprovalRequest).mockResolvedValue(approval);
    vi.mocked(mockRepo.storePendingPublishRecord).mockResolvedValue(undefined);
    vi.mocked(mockRepo.findById).mockResolvedValue(flowWithVersions);

    const result = await service.publish(FLOW_ID, 'v1', TENANT_ID, USER_ID, 'tenant_admin');
    expect(result.status).toBe('pending_approval');
    expect(result.approval_request_id).toBe('approval-1');
    expect(mockRepo.publish).not.toHaveBeenCalled();
  });

  it('creates approval request when policy requires approval and role is omitted', async () => {
    const version = makeVersion('v1', 'validated');
    const approval = makeApproval();
    const flowWithVersions = makeFlow({ versions: [version] });
    vi.mocked(mockRepo.findVersionById).mockResolvedValue(version);
    vi.mocked(mockRepo.getActivePublishPolicy).mockResolvedValue({ require_approval: true });
    vi.mocked(mockRepo.createApprovalRequest).mockResolvedValue(approval);
    vi.mocked(mockRepo.storePendingPublishRecord).mockResolvedValue(undefined);
    vi.mocked(mockRepo.findById).mockResolvedValue(flowWithVersions);

    const result = await service.publish(FLOW_ID, 'v1', TENANT_ID, USER_ID); // no role
    expect(result.status).toBe('pending_approval');
  });
});

// ── rollback ─────────────────────────────────────────────────────────────────

describe('IvrFlowService.rollback', () => {
  it('throws IvrFlowNotFoundError when flow is missing', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null);
    await expect(service.rollback(FLOW_ID, TENANT_ID, USER_ID)).rejects.toThrow(IvrFlowNotFoundError);
  });

  it('throws RollbackNotAvailableError when no superseded version exists', async () => {
    const flow = makeFlow({ versions: [makeVersion('v1', 'published')] });
    vi.mocked(mockRepo.findById).mockResolvedValue(flow);

    await expect(service.rollback(FLOW_ID, TENANT_ID, USER_ID)).rejects.toThrow(RollbackNotAvailableError);
  });

  it('rolls back directly when no approval policy is active', async () => {
    const published = makeVersion('v2', 'published');
    const superseded = makeVersion('v1', 'superseded');
    const flow = makeFlow({ versions: [published, superseded], active_version_id: 'v2' });
    const rolledBackFlow: IvrFlow = { ...makeFlow(), active_version_id: 'v1', status: 'active' };
    vi.mocked(mockRepo.findById).mockResolvedValue(flow);
    vi.mocked(mockRepo.getActivePublishPolicy).mockResolvedValue(null);
    vi.mocked(mockRepo.rollback).mockResolvedValue({ flow: rolledBackFlow, target_version_id: 'v1' });

    const result = await service.rollback(FLOW_ID, TENANT_ID, USER_ID);
    expect(result.status).toBe('published');
    expect(result.flow.active_version_id).toBe('v1');
    expect(mockRepo.createApprovalRequest).not.toHaveBeenCalled();
  });

  it('rolls back directly when policy requires approval but actor is platform_admin', async () => {
    const published = makeVersion('v2', 'published');
    const superseded = makeVersion('v1', 'superseded');
    const flow = makeFlow({ versions: [published, superseded] });
    const rolledBackFlow: IvrFlow = { ...makeFlow(), active_version_id: 'v1', status: 'active' };
    vi.mocked(mockRepo.findById).mockResolvedValue(flow);
    vi.mocked(mockRepo.getActivePublishPolicy).mockResolvedValue({ require_approval: true });
    vi.mocked(mockRepo.rollback).mockResolvedValue({ flow: rolledBackFlow, target_version_id: 'v1' });

    const result = await service.rollback(FLOW_ID, TENANT_ID, USER_ID, 'platform_admin');
    expect(result.status).toBe('published');
    expect(mockRepo.createApprovalRequest).not.toHaveBeenCalled();
  });

  it('creates approval request when policy requires approval and actor is tenant_admin', async () => {
    const published = makeVersion('v2', 'published');
    const superseded = makeVersion('v1', 'superseded');
    const flow = makeFlow({ versions: [published, superseded] });
    const approval = makeApproval();
    vi.mocked(mockRepo.findById).mockResolvedValue(flow);
    vi.mocked(mockRepo.getActivePublishPolicy).mockResolvedValue({ require_approval: true });
    vi.mocked(mockRepo.createApprovalRequest).mockResolvedValue(approval);
    vi.mocked(mockRepo.storePendingPublishRecord).mockResolvedValue(undefined);

    const result = await service.rollback(FLOW_ID, TENANT_ID, USER_ID, 'tenant_admin');
    expect(result.status).toBe('pending_approval');
    expect(result.approval_request_id).toBe('approval-1');
    expect(mockRepo.rollback).not.toHaveBeenCalled();
  });
});
