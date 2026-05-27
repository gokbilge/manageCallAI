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
    findActiveWebhooksForEvent: vi.fn(),
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
