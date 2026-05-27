import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtensionTransferReference, PromptAssetReference } from '../ivr-flows/ivr-flow.types.js';
import type { IvrRuntimeRepository } from './ivr-runtime.repository.js';
import {
  IvrRuntimeFlowNotPublishedError,
  IvrRuntimeResolutionError,
  IvrRuntimeService,
  IvrRuntimeSessionStateError,
} from './ivr-runtime.service.js';
import type { IvrRuntimeSession } from './ivr-runtime.types.js';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const FLOW_ID = '00000000-0000-0000-0000-000000000010';
const FLOW_VERSION_ID = '00000000-0000-0000-0000-000000000011';
const SESSION_ID = '00000000-0000-0000-0000-000000000012';
const PROMPT_ID = '00000000-0000-0000-0000-000000000060';
const EXTENSION_ID = '00000000-0000-0000-0000-000000000050';
const now = new Date();

const graph = {
  entry_node_id: 'start',
  nodes: [
    { id: 'start', type: 'start', next_node_id: 'welcome' },
    { id: 'welcome', type: 'play_prompt', prompt_id: PROMPT_ID, next_node_id: 'menu' },
    {
      id: 'menu',
      type: 'play_collect',
      prompt_id: PROMPT_ID,
      max_digits: 1,
      timeout_ms: 5000,
      retries: 2,
      next_node_id: 'switch',
      timeout_node_id: 'hangup',
      invalid_node_id: 'hangup',
    },
    {
      id: 'switch',
      type: 'switch',
      input: '{{last_digits}}',
      cases: { '1': 'sales' },
      default_node_id: 'hangup',
    },
    { id: 'sales', type: 'transfer_extension', extension_id: EXTENSION_ID },
    { id: 'hangup', type: 'hangup' },
  ],
};

function makeSession(extra: Partial<IvrRuntimeSession> = {}): IvrRuntimeSession {
  return {
    id: SESSION_ID,
    tenant_id: TENANT_ID,
    flow_id: FLOW_ID,
    flow_version_id: FLOW_VERSION_ID,
    call_id: 'call-1',
    status: 'running',
    current_node_id: 'welcome',
    caller_number: '+905551112233',
    destination_number: '+902122223344',
    last_digits: null,
    variables_json: {},
    last_action_json: null,
    completed_at: null,
    created_at: now,
    updated_at: now,
    ...extra,
  };
}

const promptRef: PromptAssetReference = {
  id: PROMPT_ID,
  name: 'welcome_tr',
  storage_uri: '/sounds/tenants/acme/welcome_tr.wav',
};

const extensionRef: ExtensionTransferReference = {
  id: EXTENSION_ID,
  extension_number: '200',
  display_name: 'Sales',
  directory_domain: 'acme.managecallai.local',
};

const mockRepo = {
  findActiveFlowVersion: vi.fn(),
  createSession: vi.fn(),
  findSessionById: vi.fn(),
  updateSessionState: vi.fn(),
  getFlowGraphForSession: vi.fn(),
  findActivePromptRefs: vi.fn(),
  findActiveExtensionTargets: vi.fn(),
} as unknown as IvrRuntimeRepository;

const service = new IvrRuntimeService(mockRepo);

beforeEach(() => vi.clearAllMocks());

describe('IvrRuntimeService', () => {
  it('throws when starting a session for a flow without an active published version', async () => {
    vi.mocked(mockRepo.findActiveFlowVersion).mockResolvedValue(null);
    await expect(service.startSession({ call_id: 'call-1', flow_id: FLOW_ID })).rejects.toThrow(IvrRuntimeFlowNotPublishedError);
  });

  it('starts a session and returns the first runtime action', async () => {
    vi.mocked(mockRepo.findActiveFlowVersion).mockResolvedValue({
      tenant_id: TENANT_ID,
      flow_id: FLOW_ID,
      flow_version_id: FLOW_VERSION_ID,
      graph_json: graph,
    });
    vi.mocked(mockRepo.findActivePromptRefs).mockResolvedValue(new Map([[PROMPT_ID, promptRef]]));
    vi.mocked(mockRepo.createSession).mockImplementation(async (input) => makeSession({
      current_node_id: String(input.current_node_id),
      last_action_json: input.last_action_json ?? null,
    }));

    const result = await service.startSession({
      call_id: 'call-1',
      flow_id: FLOW_ID,
      caller_number: '+905551112233',
      destination_number: '+902122223344',
    });

    expect(result.action).toEqual({
      action: 'play_prompt',
      node_id: 'welcome',
      prompt_id: PROMPT_ID,
      prompt_uri: promptRef.storage_uri!,
    });
    expect(result.session.current_node_id).toBe('welcome');
  });

  it('advances a runtime session across play_prompt, play_collect, switch, and transfer', async () => {
    vi.mocked(mockRepo.findSessionById).mockResolvedValue(makeSession());
    vi.mocked(mockRepo.getFlowGraphForSession).mockResolvedValue({
      tenant_id: TENANT_ID,
      flow_id: FLOW_ID,
      flow_version_id: FLOW_VERSION_ID,
      graph_json: graph,
    });
    vi.mocked(mockRepo.findActivePromptRefs).mockResolvedValue(new Map([[PROMPT_ID, promptRef]]));
    vi.mocked(mockRepo.findActiveExtensionTargets).mockResolvedValue(new Map([[EXTENSION_ID, extensionRef]]));
    vi.mocked(mockRepo.updateSessionState)
      .mockResolvedValueOnce(makeSession({
        current_node_id: 'menu',
        last_action_json: { action: 'play_collect', node_id: 'menu' },
      }))
      .mockResolvedValueOnce(makeSession({
        current_node_id: 'sales',
        last_digits: '1',
        variables_json: { last_digits: '1', 'node.menu.digits': '1' },
        last_action_json: { action: 'transfer', node_id: 'sales' },
      }))
      .mockResolvedValueOnce(makeSession({
        status: 'completed',
        current_node_id: null,
        last_digits: '1',
        variables_json: { last_digits: '1', 'node.menu.digits': '1' },
        last_action_json: null,
        completed_at: now,
      }));

    const firstAdvance = await service.advanceSession(SESSION_ID, {
      node_id: 'welcome',
      outcome: 'completed',
    });
    expect(firstAdvance.action?.action).toBe('play_collect');
    expect(firstAdvance.session.current_node_id).toBe('menu');

    vi.mocked(mockRepo.findSessionById).mockResolvedValueOnce(makeSession({
      current_node_id: 'menu',
      last_action_json: { action: 'play_collect', node_id: 'menu' },
    }));

    const secondAdvance = await service.advanceSession(SESSION_ID, {
      node_id: 'menu',
      outcome: 'digits',
      digits: '1',
    });
    expect(secondAdvance.action).toEqual({
      action: 'transfer',
      node_id: 'sales',
      target_type: 'extension',
      target: '200',
      domain: 'acme.managecallai.local',
    });

    vi.mocked(mockRepo.findSessionById).mockResolvedValueOnce(makeSession({
      current_node_id: 'sales',
      last_digits: '1',
      variables_json: { last_digits: '1', 'node.menu.digits': '1' },
      last_action_json: { action: 'transfer', node_id: 'sales' },
    }));

    const finalAdvance = await service.advanceSession(SESSION_ID, {
      node_id: 'sales',
      outcome: 'completed',
    });
    expect(finalAdvance.action).toBeNull();
    expect(finalAdvance.session.status).toBe('completed');
  });

  it('throws when a play_collect node resolves to digits without a payload', async () => {
    vi.mocked(mockRepo.findSessionById).mockResolvedValue(makeSession({ current_node_id: 'menu' }));
    vi.mocked(mockRepo.getFlowGraphForSession).mockResolvedValue({
      tenant_id: TENANT_ID,
      flow_id: FLOW_ID,
      flow_version_id: FLOW_VERSION_ID,
      graph_json: graph,
    });

    await expect(service.advanceSession(SESSION_ID, {
      node_id: 'menu',
      outcome: 'digits',
    })).rejects.toThrow(IvrRuntimeSessionStateError);
  });

  it('throws when a prompt action cannot resolve an active prompt asset', async () => {
    vi.mocked(mockRepo.findActiveFlowVersion).mockResolvedValue({
      tenant_id: TENANT_ID,
      flow_id: FLOW_ID,
      flow_version_id: FLOW_VERSION_ID,
      graph_json: graph,
    });
    vi.mocked(mockRepo.findActivePromptRefs).mockResolvedValue(new Map());

    await expect(service.startSession({ call_id: 'call-1', flow_id: FLOW_ID })).rejects.toThrow(IvrRuntimeResolutionError);
  });
});
