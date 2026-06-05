import { describe, expect, it, vi } from 'vitest';
import type { ProviderWorkRepository } from './provider-work.repository.js';
import { ProviderWorkRequestNotFoundError, ProviderWorkService } from './provider-work.service.js';

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
});
