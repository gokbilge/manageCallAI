import { describe, it, expect, vi } from 'vitest';
import { AutomationService, ApiKeyNotFoundError, WebhookNotFoundError } from './automation.service.js';
import { AutomationRepository } from './automation.repository.js';
import type { ApiKey, AutomationWebhook } from './automation.types.js';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID   = '00000000-0000-0000-0000-000000000002';
const KEY_ID    = '00000000-0000-0000-0000-000000000010';
const HOOK_ID   = '00000000-0000-0000-0000-000000000020';
const now = new Date();

function makeApiKey(overrides: Partial<ApiKey> = {}): ApiKey {
  return {
    id: KEY_ID,
    tenant_id: TENANT_ID,
    name: 'ci-key',
    key_prefix: 'abcd1234',
    capabilities: ['*'],
    created_by: USER_ID,
    created_at: now,
    revoked_at: null,
    ...overrides,
  };
}

function makeWebhook(overrides: Partial<AutomationWebhook> = {}): AutomationWebhook {
  return {
    id: HOOK_ID,
    tenant_id: TENANT_ID,
    name: 'my-hook',
    url: 'https://example.com/hook',
    events: ['ivr_flow.published'],
    failure_count: 0,
    disabled_at: null,
    created_by: USER_ID,
    created_at: now,
    revoked_at: null,
    ...overrides,
  };
}

function makeMockRepo(): AutomationRepository {
  return {
    createApiKey: vi.fn().mockResolvedValue(makeApiKey()),
    findApiKeyByHash: vi.fn().mockResolvedValue({ id: KEY_ID, tenant_id: TENANT_ID, capabilities: ['tenant.extensions.view'], expires_at: null }),
    listApiKeys: vi.fn().mockResolvedValue([makeApiKey()]),
    revokeApiKey: vi.fn().mockResolvedValue(true),
    generateApiKey: vi.fn().mockReturnValue({ rawKey: 'mcak_abc', keyHash: 'hash', keyPrefix: 'abcd' }),
    createWebhook: vi.fn().mockResolvedValue(makeWebhook()),
    listWebhooks: vi.fn().mockResolvedValue([makeWebhook()]),
    revokeWebhook: vi.fn().mockResolvedValue(true),
    findWebhookById: vi.fn().mockResolvedValue(makeWebhook()),
    findDeliveryLog: vi.fn().mockResolvedValue([]),
    findDeliveryQueueForWebhook: vi.fn().mockResolvedValue([]),
    findActiveWebhooksForEvent: vi.fn().mockResolvedValue([]),
    recordDeliveryFailure: vi.fn().mockResolvedValue(undefined),
    resetDeliveryFailure: vi.fn().mockResolvedValue(undefined),
    logDeliveryAttempt: vi.fn().mockResolvedValue(undefined),
    enqueueWebhookDeliveries: vi.fn().mockResolvedValue([]),
    claimDueWebhookDeliveries: vi.fn().mockResolvedValue([]),
    markWebhookDeliveryDelivered: vi.fn().mockResolvedValue(undefined),
    markWebhookDeliveryFailed: vi.fn().mockResolvedValue(undefined),
    listAbandonedDeliveries: vi.fn().mockResolvedValue([]),
    retryAbandonedDelivery: vi.fn().mockResolvedValue(null),
    dismissAbandonedDelivery: vi.fn().mockResolvedValue(false),
  } as unknown as AutomationRepository;
}

// ── API key tests ─────────────────────────────────────────────────────────────

describe('AutomationService.createApiKey', () => {
  it('creates a key with explicit capabilities', async () => {
    const repo = makeMockRepo();
    vi.mocked(repo.createApiKey).mockResolvedValue(
      makeApiKey({ capabilities: ['tenant.extensions.view'] }),
    );
    const service = new AutomationService(repo);
    await service.createApiKey(TENANT_ID, 'test-key', ['tenant.extensions.view']);
    expect(repo.createApiKey).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: TENANT_ID, name: 'test-key', capabilities: ['tenant.extensions.view'] }),
    );
  });

  it('rejects an empty capabilities array', async () => {
    const repo = makeMockRepo();
    const service = new AutomationService(repo);
    await expect(service.createApiKey(TENANT_ID, 'test-key', [])).rejects.toThrow(/empty/);
  });

  it('rejects the wildcard sentinel', async () => {
    const repo = makeMockRepo();
    const service = new AutomationService(repo);
    await expect(service.createApiKey(TENANT_ID, 'test-key', ['*'])).rejects.toThrow(/wildcard/i);
  });

  it('passes explicit capabilities to the repository', async () => {
    const repo = makeMockRepo();
    vi.mocked(repo.createApiKey).mockResolvedValue(
      makeApiKey({ capabilities: ['tenant.ivr_flows.view', 'tenant.ivr_flows.simulate'] }),
    );
    const service = new AutomationService(repo);
    const key = await service.createApiKey(
      TENANT_ID,
      'scoped-key',
      ['tenant.ivr_flows.view', 'tenant.ivr_flows.simulate'],
    );
    expect(key.capabilities).toEqual(['tenant.ivr_flows.view', 'tenant.ivr_flows.simulate']);
  });

  it('resolveApiKey returns capabilities from the DB record', async () => {
    const repo = makeMockRepo();
    vi.mocked(repo.findApiKeyByHash).mockResolvedValue({
      id: KEY_ID,
      tenant_id: TENANT_ID,
      capabilities: ['tenant.extensions.view'],
      expires_at: null,
    });
    const service = new AutomationService(repo);
    const claims = await service.resolveApiKey('mcak_abc');
    expect(claims?.capabilities).toEqual(['tenant.extensions.view']);
    expect(claims?.role).toBeUndefined();
  });

  it('resolveApiKey returns null for an expired key', async () => {
    const repo = makeMockRepo();
    vi.mocked(repo.findApiKeyByHash).mockResolvedValue({
      id: KEY_ID,
      tenant_id: TENANT_ID,
      capabilities: ['tenant.extensions.view'],
      expires_at: new Date(Date.now() - 1000),
    });
    const service = new AutomationService(repo);
    const claims = await service.resolveApiKey('mcak_abc');
    expect(claims).toBeNull();
  });

  it('revokeApiKey throws ApiKeyNotFoundError when key is not found', async () => {
    const repo = makeMockRepo();
    vi.mocked(repo.revokeApiKey).mockResolvedValue(false);
    const service = new AutomationService(repo);
    await expect(service.revokeApiKey(KEY_ID, TENANT_ID)).rejects.toThrow(ApiKeyNotFoundError);
  });
});

// ── Webhook DLQ tests ─────────────────────────────────────────────────────────

describe('AutomationService.DLQ', () => {
  it('retryAbandonedDelivery throws WebhookNotFoundError when item not found', async () => {
    const repo = makeMockRepo();
    vi.mocked(repo.retryAbandonedDelivery).mockResolvedValue(null);
    const service = new AutomationService(repo);
    await expect(service.retryAbandonedDelivery('dlq-1', TENANT_ID)).rejects.toThrow(WebhookNotFoundError);
  });

  it('dismissAbandonedDelivery throws WebhookNotFoundError when item not found', async () => {
    const repo = makeMockRepo();
    vi.mocked(repo.dismissAbandonedDelivery).mockResolvedValue(false);
    const service = new AutomationService(repo);
    await expect(service.dismissAbandonedDelivery('dlq-1', TENANT_ID, 'resolved')).rejects.toThrow(WebhookNotFoundError);
  });

  it('listAbandonedDeliveries delegates to repo with tenant scope', async () => {
    const repo = makeMockRepo();
    const service = new AutomationService(repo);
    await service.listAbandonedDeliveries(TENANT_ID, 25);
    expect(repo.listAbandonedDeliveries).toHaveBeenCalledWith(TENANT_ID, 25);
  });
});

// ── Webhook service tests ─────────────────────────────────────────────────────

describe('AutomationService.createWebhook', () => {
  it('creates a webhook with signing_secret', async () => {
    const repo = makeMockRepo();
    const service = new AutomationService(repo);
    const result = await service.createWebhook(TENANT_ID, 'hook', 'https://x.com', ['call.completed']);
    expect(result.signing_secret).toBeDefined();
  });
});

describe('AutomationService.revokeWebhook', () => {
  it('throws WebhookNotFoundError when webhook not found', async () => {
    const repo = makeMockRepo();
    vi.mocked(repo.revokeWebhook).mockResolvedValue(false);
    const service = new AutomationService(repo);
    await expect(service.revokeWebhook(HOOK_ID, TENANT_ID)).rejects.toThrow(WebhookNotFoundError);
  });
});
