import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    createApiKey: vi.fn(),
    findApiKeyByHash: vi.fn(),
    listApiKeys: vi.fn(),
    revokeApiKey: vi.fn(),
    createWebhook: vi.fn(),
    listWebhooks: vi.fn(),
    revokeWebhook: vi.fn(),
    findWebhookById: vi.fn(),
    findActiveWebhooksForEvent: vi.fn(),
    recordDeliveryFailure: vi.fn(),
    resetDeliveryFailure: vi.fn(),
    logDeliveryAttempt: vi.fn().mockResolvedValue(undefined),
    findDeliveryLog: vi.fn().mockResolvedValue([]),
    enqueueWebhookDeliveries: vi.fn().mockResolvedValue([]),
    claimDueWebhookDeliveries: vi.fn().mockResolvedValue([]),
    markWebhookDeliveryDelivered: vi.fn().mockResolvedValue(undefined),
    markWebhookDeliveryFailed: vi.fn().mockResolvedValue(undefined),
    findDeliveryQueueForWebhook: vi.fn().mockResolvedValue([]),
  } as unknown as AutomationRepository;
}

describe('AutomationService', () => {
  let repo: AutomationRepository;
  let service: AutomationService;

  beforeEach(() => {
    repo = makeMockRepo();
    service = new AutomationService(repo);
  });

  describe('createApiKey', () => {
    it('generates a mcak_ prefixed key and stores its hash', async () => {
      const keyRecord = makeApiKey();
      vi.mocked(repo.createApiKey).mockResolvedValue(keyRecord);

      const result = await service.createApiKey(TENANT_ID, 'ci-key', USER_ID);

      expect(result.key).toMatch(/^mcak_[0-9a-f]{64}$/);
      expect(result.key_prefix).toBe('abcd1234');
      expect(repo.createApiKey).toHaveBeenCalledWith(
        expect.objectContaining({ tenant_id: TENANT_ID, name: 'ci-key', created_by: USER_ID }),
      );
    });

    it('stores a different hash than the raw key', async () => {
      vi.mocked(repo.createApiKey).mockResolvedValue(makeApiKey());
      await service.createApiKey(TENANT_ID, 'test', USER_ID);

      const [call] = vi.mocked(repo.createApiKey).mock.calls;
      const { key_hash } = call![0];
      expect(key_hash).toHaveLength(64); // sha256 hex
      expect(key_hash).not.toMatch(/^mcak_/);
    });
  });

  describe('resolveApiKey', () => {
    it('returns AuthClaims for a valid key', async () => {
      vi.mocked(repo.findApiKeyByHash).mockResolvedValue({ id: KEY_ID, tenant_id: TENANT_ID });

      const rawKey = 'mcak_' + 'a'.repeat(64);
      const claims = await service.resolveApiKey(rawKey);

      expect(claims).toMatchObject({ tenant_id: TENANT_ID, role: 'tenant_admin' });
    });

    it('returns null for an unknown or revoked key', async () => {
      vi.mocked(repo.findApiKeyByHash).mockResolvedValue(null);

      const claims = await service.resolveApiKey('mcak_' + '0'.repeat(64));
      expect(claims).toBeNull();
    });
  });

  describe('revokeApiKey', () => {
    it('delegates revocation to repo', async () => {
      vi.mocked(repo.revokeApiKey).mockResolvedValue(true);
      await expect(service.revokeApiKey(KEY_ID, TENANT_ID)).resolves.toBeUndefined();
    });

    it('throws ApiKeyNotFoundError when key does not exist', async () => {
      vi.mocked(repo.revokeApiKey).mockResolvedValue(false);
      await expect(service.revokeApiKey(KEY_ID, TENANT_ID)).rejects.toThrow(ApiKeyNotFoundError);
    });
  });

  describe('createWebhook', () => {
    it('generates a signing secret and returns it with the record', async () => {
      const hookRecord = makeWebhook();
      vi.mocked(repo.createWebhook).mockResolvedValue(hookRecord);

      const result = await service.createWebhook(TENANT_ID, 'my-hook', 'https://example.com/hook', ['ivr_flow.published'], USER_ID);

      expect(result.signing_secret).toMatch(/^[0-9a-f]{64}$/);
      expect(repo.createWebhook).toHaveBeenCalledWith(
        expect.objectContaining({ tenant_id: TENANT_ID, url: 'https://example.com/hook' }),
      );
    });
  });

  describe('revokeWebhook', () => {
    it('delegates to repo', async () => {
      vi.mocked(repo.revokeWebhook).mockResolvedValue(true);
      await expect(service.revokeWebhook(HOOK_ID, TENANT_ID)).resolves.toBeUndefined();
    });

    it('throws WebhookNotFoundError when webhook does not exist', async () => {
      vi.mocked(repo.revokeWebhook).mockResolvedValue(false);
      await expect(service.revokeWebhook(HOOK_ID, TENANT_ID)).rejects.toThrow(WebhookNotFoundError);
    });
  });

  describe('getDeliveryHistory', () => {
    it('returns delivery log for owned webhook', async () => {
      vi.mocked(repo.findWebhookById).mockResolvedValue(makeWebhook());
      vi.mocked(repo.findDeliveryLog).mockResolvedValue([]);
      const result = await service.getDeliveryHistory(HOOK_ID, TENANT_ID);
      expect(Array.isArray(result)).toBe(true);
      expect(repo.findWebhookById).toHaveBeenCalledWith(HOOK_ID, TENANT_ID);
    });

    it('throws WebhookNotFoundError for unknown webhook', async () => {
      vi.mocked(repo.findWebhookById).mockResolvedValue(null);
      await expect(service.getDeliveryHistory('bad-id', TENANT_ID)).rejects.toThrow(WebhookNotFoundError);
    });
  });

  describe('webhook delivery queue', () => {
    it('enqueues webhook events without calling fetch inline', async () => {
      global.fetch = vi.fn();

      const queued = await service.enqueueWebhooks(TENANT_ID, 'ivr_flow.published', { flow_id: 'flow-1' });

      expect(queued).toEqual([]);
      expect(repo.enqueueWebhookDeliveries).toHaveBeenCalledWith(expect.objectContaining({
        tenant_id: TENANT_ID,
        event: 'ivr_flow.published',
        payload_json: expect.objectContaining({ event: 'ivr_flow.published', tenant_id: TENANT_ID }),
      }));
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('marks claimed delivery as failed when fetch rejects', async () => {
      vi.mocked(repo.claimDueWebhookDeliveries).mockResolvedValue([{
        id: 'delivery-1',
        webhook_id: HOOK_ID,
        tenant_id: TENANT_ID,
        event: 'ivr_flow.published',
        payload_json: { event: 'ivr_flow.published', tenant_id: TENANT_ID, data: {}, timestamp: now.toISOString() },
        status: 'processing',
        attempt_count: 1,
        max_attempts: 3,
        next_attempt_at: now,
        claimed_at: now,
        delivered_at: null,
        last_response_code: null,
        last_error: null,
        created_at: now,
        updated_at: now,
        url: 'https://example.com/hook',
        signing_secret: 'sec',
      }]);
      vi.mocked(repo.recordDeliveryFailure).mockResolvedValue(undefined);
      global.fetch = vi.fn().mockRejectedValue(new Error('network error'));

      const result = await service.processDueWebhookDeliveries();

      expect(repo.recordDeliveryFailure).toHaveBeenCalledWith(HOOK_ID);
      expect(repo.markWebhookDeliveryFailed).toHaveBeenCalledWith(expect.objectContaining({
        delivery_id: 'delivery-1',
        error_message: 'network error',
      }));
      expect(result).toEqual({ claimed: 1, delivered: 0, failed: 1 });
    });

    it('marks claimed delivery as delivered when fetch succeeds', async () => {
      vi.mocked(repo.claimDueWebhookDeliveries).mockResolvedValue([{
        id: 'delivery-2',
        webhook_id: HOOK_ID,
        tenant_id: TENANT_ID,
        event: 'ivr_flow.published',
        payload_json: { event: 'ivr_flow.published', tenant_id: TENANT_ID, data: {}, timestamp: now.toISOString() },
        status: 'processing',
        attempt_count: 1,
        max_attempts: 3,
        next_attempt_at: now,
        claimed_at: now,
        delivered_at: null,
        last_response_code: null,
        last_error: null,
        created_at: now,
        updated_at: now,
        url: 'https://example.com/hook',
        signing_secret: 'sec',
      }]);
      vi.mocked(repo.resetDeliveryFailure).mockResolvedValue(undefined);

      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204 });

      const result = await service.processDueWebhookDeliveries();

      expect(repo.resetDeliveryFailure).toHaveBeenCalledWith(HOOK_ID);
      expect(repo.markWebhookDeliveryDelivered).toHaveBeenCalledWith(expect.objectContaining({
        delivery_id: 'delivery-2',
        response_code: 204,
      }));
      expect(result).toEqual({ claimed: 1, delivered: 1, failed: 0 });
    });
  });

  describe('AutomationRepository static helpers', () => {
    it('hashKey produces consistent sha256 output', () => {
      const key = 'mcak_test';
      const h1 = AutomationRepository.hashKey(key);
      const h2 = AutomationRepository.hashKey(key);
      expect(h1).toBe(h2);
      expect(h1).toHaveLength(64);
    });

    it('generateApiKey produces unique keys', () => {
      const a = AutomationRepository.generateApiKey();
      const b = AutomationRepository.generateApiKey();
      expect(a.rawKey).toMatch(/^mcak_[0-9a-f]{64}$/);
      expect(a.rawKey).not.toBe(b.rawKey);
      expect(a.keyHash).not.toBe(b.keyHash);
    });

    it('signPayload produces consistent HMAC', () => {
      const s1 = AutomationRepository.signPayload('secret', 'body');
      const s2 = AutomationRepository.signPayload('secret', 'body');
      expect(s1).toBe(s2);
      expect(s1).toHaveLength(64);
    });
  });
});
