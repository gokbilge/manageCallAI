import { describe, expect, it, vi } from 'vitest';
import type { ProviderWorkRepository } from './provider-work.repository.js';
import { ProviderWorkRequestNotFoundError, ProviderWorkService } from './provider-work.service.js';
import type { IvrGenerationRequest, IvrAiPatchRequest } from './provider-work.types.js';

const promptRequest = {
  id: 'prompt-gen-1',
  tenant_id: 'tenant-1',
  prompt_asset_id: null,
  requested_outputs: ['audio'],
  input_text: 'Welcome to Acme.',
  language_hint: 'en-US',
  voice_hint: 'warm',
  provider_hint: 'auto' as const,
  status: 'queued' as const,
  processor_id: null,
  claimed_at: null,
  generated_prompt_asset_id: null,
  media_reference: null,
  error_message: null,
  provider_metadata: {},
  metadata: {},
  created_at: '2026-05-29T10:00:00Z',
  completed_at: null,
};

const ivrAiTurn = {
  id: 'ivr-ai-1',
  tenant_id: 'tenant-1',
  runtime_session_id: 'session-1',
  call_id: 'call-1',
  flow_id: null,
  node_id: 'ai-node',
  input_mode: 'text' as const,
  input_text: 'What are your hours?',
  requested_outputs: ['answer_text'],
  provider_hint: 'auto' as const,
  status: 'queued' as const,
  processor_id: null,
  claimed_at: null,
  answer_text: null,
  next_action: null,
  confidence: null,
  error_message: null,
  provider_metadata: {},
  metadata: {},
  created_at: '2026-05-29T10:00:00Z',
  completed_at: null,
};

const genRequest: IvrGenerationRequest = {
  id: 'gen-1',
  tenant_id: 'tenant-1',
  flow_id: null,
  version_id: null,
  intent: 'Main menu IVR with sales and support options',
  flow_name: 'Main Menu',
  provider_hint: 'auto',
  status: 'queued',
  processor_id: null,
  claimed_at: null,
  generated_graph: null,
  error_message: null,
  provider_metadata: {},
  metadata: {},
  created_at: '2026-06-06T10:00:00Z',
  completed_at: null,
};

const patchRequest: IvrAiPatchRequest = {
  id: 'patch-1',
  tenant_id: 'tenant-1',
  target_type: 'ivr_flow',
  target_id: 'flow-1',
  version_id: 'version-1',
  intent: 'Add a VIP caller branch',
  provider_hint: 'auto',
  status: 'queued',
  processor_id: null,
  claimed_at: null,
  diff_json: null,
  risk_level: null,
  risk_summary: null,
  blast_radius_hint: null,
  accepted_at: null,
  rejected_at: null,
  decided_by: null,
  error_message: null,
  provider_metadata: {},
  metadata: {},
  created_at: '2026-06-06T10:00:00Z',
  completed_at: null,
};

function makeRepo(): ProviderWorkRepository {
  return {
    createPromptGeneration: vi.fn().mockResolvedValue(promptRequest),
    listPromptGenerations: vi.fn().mockResolvedValue([promptRequest]),
    findPromptGeneration: vi.fn().mockResolvedValue(promptRequest),
    claimPromptGeneration: vi.fn().mockResolvedValue({ ...promptRequest, status: 'processing' }),
    completePromptGeneration: vi.fn().mockResolvedValue({ ...promptRequest, status: 'completed' }),
    createIvrAiTurn: vi.fn().mockResolvedValue(ivrAiTurn),
    findIvrAiTurn: vi.fn().mockResolvedValue(ivrAiTurn),
    claimIvrAiTurn: vi.fn().mockResolvedValue({ ...ivrAiTurn, status: 'processing' }),
    completeIvrAiTurn: vi.fn().mockResolvedValue({ ...ivrAiTurn, status: 'completed', answer_text: 'We are open.' }),
    createIvrGeneration: vi.fn().mockResolvedValue(genRequest),
    listIvrGenerations: vi.fn().mockResolvedValue([genRequest]),
    findIvrGeneration: vi.fn().mockResolvedValue(genRequest),
    linkIvrGenerationToFlow: vi.fn().mockResolvedValue(undefined),
    claimIvrGeneration: vi.fn().mockResolvedValue({ ...genRequest, status: 'processing' }),
    completeIvrGeneration: vi.fn().mockResolvedValue({ ...genRequest, status: 'completed', generated_graph: { nodes: [], edges: [] } }),
    createIvrAiPatch: vi.fn().mockResolvedValue(patchRequest),
    listIvrAiPatches: vi.fn().mockResolvedValue([patchRequest]),
    findIvrAiPatch: vi.fn().mockResolvedValue(patchRequest),
    claimIvrAiPatch: vi.fn().mockResolvedValue({ ...patchRequest, status: 'processing' }),
    completeIvrAiPatch: vi.fn().mockResolvedValue({ ...patchRequest, status: 'completed', diff_json: { nodes: { add: [], remove: [], modify: [] } }, risk_level: 'low' }),
    acceptIvrAiPatch: vi.fn().mockResolvedValue({ ...patchRequest, status: 'accepted', accepted_at: '2026-06-06T10:05:00Z' }),
    rejectIvrAiPatch: vi.fn().mockResolvedValue({ ...patchRequest, status: 'rejected', rejected_at: '2026-06-06T10:05:00Z' }),
  } as unknown as ProviderWorkRepository;
}

describe('ProviderWorkService', () => {
  it('creates prompt generation work with provider-neutral inputs', async () => {
    const repo = makeRepo();
    const service = new ProviderWorkService(repo);

    const result = await service.createPromptGeneration('tenant-1', {
      requested_outputs: ['audio'],
      input_text: 'Welcome to Acme.',
      provider_hint: 'auto',
    });

    expect(result.status).toBe('queued');
    expect(repo.createPromptGeneration).toHaveBeenCalledWith('tenant-1', expect.objectContaining({
      requested_outputs: ['audio'],
      provider_hint: 'auto',
    }));
  });

  it('records deterministic fallback metadata when a runtime IVR turn requests provider-backed execution without policy support', async () => {
    const repo = makeRepo();
    const policyService = {
      resolveProvider: vi.fn().mockResolvedValue({
        requested_provider_hint: 'openai',
        effective_provider_hint: 'auto',
        provider_backed_requested: true,
        provider_backed_allowed: false,
        fallback_reason: 'tenant_provider_backed_disabled',
        policy: {} as Record<string, unknown>,
      }),
      requireProviderBackedAccess: vi.fn(),
    };
    const service = new ProviderWorkService(repo, policyService as never);

    await service.createIvrAiTurn('tenant-1', {
      call_id: 'call-1',
      node_id: 'ai-node',
      input_mode: 'text',
      requested_outputs: ['answer_text'],
      provider_hint: 'openai',
    });

    expect(repo.createIvrAiTurn).toHaveBeenCalledWith('tenant-1', expect.objectContaining({
      provider_hint: 'auto',
      metadata: expect.objectContaining({
        ai_policy: expect.objectContaining({
          fallback_reason: 'tenant_provider_backed_disabled',
        }),
      }),
    }));
  });

  it('claims and completes IVR AI turn work', async () => {
    const repo = makeRepo();
    const service = new ProviderWorkService(repo);

    const claimed = await service.claimIvrAiTurn('ivr-ai-1', { processor_id: 'processor-1' });
    const completed = await service.completeIvrAiTurn('ivr-ai-1', {
      status: 'completed',
      answer_text: 'We are open.',
      confidence: 0.9,
    });

    expect(claimed.status).toBe('processing');
    expect(completed.answer_text).toBe('We are open.');
  });

  it('throws when a work request cannot be found or claimed', async () => {
    const repo = makeRepo();
    vi.mocked(repo.claimPromptGeneration).mockResolvedValueOnce(null);
    const service = new ProviderWorkService(repo);

    await expect(service.claimPromptGeneration('missing', {})).rejects.toBeInstanceOf(ProviderWorkRequestNotFoundError);
  });

  it('creates an IVR generation request with policy metadata', async () => {
    const repo = makeRepo();
    const service = new ProviderWorkService(repo);

    const result = await service.createIvrGeneration('tenant-1', {
      flow_name: 'Main Menu',
      intent: 'Main menu IVR with sales and support options',
    });

    expect(result.id).toBe('gen-1');
    expect(result.status).toBe('queued');
    expect(repo.createIvrGeneration).toHaveBeenCalledWith('tenant-1', expect.objectContaining({
      intent: 'Main menu IVR with sales and support options',
      flow_name: 'Main Menu',
    }));
  });

  it('claims and completes IVR generation work', async () => {
    const repo = makeRepo();
    const service = new ProviderWorkService(repo);

    const claimed = await service.claimIvrGeneration('gen-1', { processor_id: 'worker-1' });
    const completed = await service.completeIvrGeneration('gen-1', {
      status: 'completed',
      generated_graph: { nodes: [], edges: [] },
    });

    expect(claimed.status).toBe('processing');
    expect(completed.generated_graph).toEqual({ nodes: [], edges: [] });
  });

  it('throws ProviderWorkRequestNotFoundError when IVR generation is not claimable', async () => {
    const repo = makeRepo();
    vi.mocked(repo.claimIvrGeneration).mockResolvedValueOnce(null);
    const service = new ProviderWorkService(repo);

    await expect(service.claimIvrGeneration('missing', {})).rejects.toBeInstanceOf(ProviderWorkRequestNotFoundError);
  });

  it('creates an IVR AI patch request', async () => {
    const repo = makeRepo();
    const service = new ProviderWorkService(repo);

    const result = await service.createIvrAiPatch('tenant-1', {
      target_type: 'ivr_flow',
      target_id: 'flow-1',
      version_id: 'version-1',
      intent: 'Add a VIP caller branch',
    });

    expect(result.id).toBe('patch-1');
    expect(result.status).toBe('queued');
    expect(repo.createIvrAiPatch).toHaveBeenCalledWith('tenant-1', expect.objectContaining({
      target_type: 'ivr_flow',
      target_id: 'flow-1',
      intent: 'Add a VIP caller branch',
    }));
  });

  it('claims and completes IVR AI patch work with diff and risk', async () => {
    const repo = makeRepo();
    const service = new ProviderWorkService(repo);

    const claimed = await service.claimIvrAiPatch('patch-1', { processor_id: 'worker-1' });
    const completed = await service.completeIvrAiPatch('patch-1', {
      status: 'completed',
      diff_json: { nodes: { add: [], remove: [], modify: [] } },
      risk_level: 'low',
      risk_summary: 'No existing nodes modified',
      blast_radius_hint: 'Affects only new VIP branch, no existing paths changed',
    });

    expect(claimed.status).toBe('processing');
    expect(completed.status).toBe('completed');
    expect(completed.risk_level).toBe('low');
  });

  it('accepts and rejects IVR AI patches by decision', async () => {
    const repo = makeRepo();
    const service = new ProviderWorkService(repo);

    const accepted = await service.acceptIvrAiPatch('patch-1', 'tenant-1', 'user-1');
    expect(accepted.status).toBe('accepted');
    expect(accepted.accepted_at).toBeTruthy();

    vi.mocked(repo.acceptIvrAiPatch).mockResolvedValueOnce(null);
    vi.mocked(repo.rejectIvrAiPatch).mockResolvedValueOnce({ ...patchRequest, status: 'rejected', rejected_at: '2026-06-06T10:05:00Z' });

    const rejected = await service.rejectIvrAiPatch('patch-1', 'tenant-1', 'user-1');
    expect(rejected.status).toBe('rejected');
  });

  it('throws ProviderWorkRequestNotFoundError when patch cannot be found for accept', async () => {
    const repo = makeRepo();
    vi.mocked(repo.acceptIvrAiPatch).mockResolvedValueOnce(null);
    const service = new ProviderWorkService(repo);

    await expect(service.acceptIvrAiPatch('missing', 'tenant-1', 'user-1')).rejects.toBeInstanceOf(ProviderWorkRequestNotFoundError);
  });
});
