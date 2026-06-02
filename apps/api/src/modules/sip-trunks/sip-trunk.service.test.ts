import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SipTrunkService, SipTrunkNotFoundError } from './sip-trunk.service.js';
import type { SipTrunkRepository } from './sip-trunk.repository.js';
import type { SipTrunk } from './sip-trunk.types.js';

vi.mock('../../crypto/sip-secret.js', () => ({
  encryptSipPassword: vi.fn().mockReturnValue({ ciphertext: 'encrypted', keyId: 'key-1' }),
}));

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const TRUNK_ID  = '00000000-0000-0000-0000-000000000010';
const now = new Date();

function makeTrunk(overrides: Partial<SipTrunk> = {}): SipTrunk {
  return {
    id: TRUNK_ID,
    tenant_id: TENANT_ID,
    name: 'PSTN Trunk',
    direction: 'bidirectional',
    status: 'active',
    username: null,
    realm: 'sip.example.com',
    proxy: 'sip.example.com',
    port: 5060,
    transport: 'udp',
    auth_username: 'trunk1',
    dtmf_mode: 'rfc2833',
    codec_prefs: null,
    srtp_policy: 'disabled',
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function makeMockRepo(): SipTrunkRepository {
  return {
    findAllByTenant: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
  } as unknown as SipTrunkRepository;
}

describe('SipTrunkService', () => {
  let repo: SipTrunkRepository;
  let service: SipTrunkService;

  beforeEach(() => {
    repo = makeMockRepo();
    service = new SipTrunkService(repo);
  });

  describe('listByTenant', () => {
    it('delegates to repo', async () => {
      const trunks = [makeTrunk()];
      vi.mocked(repo.findAllByTenant).mockResolvedValue(trunks);
      expect(await service.listByTenant(TENANT_ID)).toBe(trunks);
      expect(repo.findAllByTenant).toHaveBeenCalledWith(TENANT_ID);
    });
  });

  describe('getById', () => {
    it('returns trunk when found', async () => {
      const trunk = makeTrunk();
      vi.mocked(repo.findById).mockResolvedValue(trunk);
      expect(await service.getById(TRUNK_ID, TENANT_ID)).toBe(trunk);
    });

    it('throws SipTrunkNotFoundError when not found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);
      await expect(service.getById(TRUNK_ID, TENANT_ID)).rejects.toThrow(SipTrunkNotFoundError);
    });
  });

  describe('create', () => {
    it('encrypts auth_password and calls repo.create', async () => {
      const { encryptSipPassword } = await import('../../crypto/sip-secret.js');
      const trunk = makeTrunk();
      vi.mocked(repo.create).mockResolvedValue(trunk);

      const result = await service.create({
        tenant_id: TENANT_ID,
        name: 'PSTN Trunk',
        direction: 'bidirectional',
        realm: 'sip.example.com',
        proxy: 'sip.example.com',
        auth_username: 'trunk1',
        auth_password: 'secret123',
      });

      expect(encryptSipPassword).toHaveBeenCalledWith('secret123');
      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
        auth_password_ciphertext: 'encrypted',
        auth_password_key_id: 'key-1',
      }));
      expect(result).toBe(trunk);
    });
  });

  describe('update', () => {
    it('re-encrypts password when auth_password is provided', async () => {
      const { encryptSipPassword } = await import('../../crypto/sip-secret.js');
      const trunk = makeTrunk({ name: 'Updated' });
      vi.mocked(repo.update).mockResolvedValue(trunk);

      await service.update(TRUNK_ID, TENANT_ID, { name: 'Updated', auth_password: 'newsecret' });

      expect(encryptSipPassword).toHaveBeenCalledWith('newsecret');
      expect(repo.update).toHaveBeenCalledWith(TRUNK_ID, TENANT_ID, expect.objectContaining({
        auth_password_ciphertext: 'encrypted',
        auth_password_key_id: 'key-1',
      }));
    });

    it('skips re-encryption when auth_password is omitted', async () => {
      vi.mocked(repo.update).mockResolvedValue(makeTrunk());
      const { encryptSipPassword } = await import('../../crypto/sip-secret.js');
      vi.mocked(encryptSipPassword).mockClear();

      await service.update(TRUNK_ID, TENANT_ID, { name: 'Only name' });

      expect(encryptSipPassword).not.toHaveBeenCalled();
      expect(repo.update).toHaveBeenCalledWith(TRUNK_ID, TENANT_ID, { name: 'Only name' });
    });

    it('throws SipTrunkNotFoundError when repo returns null', async () => {
      vi.mocked(repo.update).mockResolvedValue(null);
      await expect(service.update(TRUNK_ID, TENANT_ID, { name: 'X' })).rejects.toThrow(SipTrunkNotFoundError);
    });
  });

  describe('deactivate', () => {
    it('deactivates and returns trunk', async () => {
      const trunk = makeTrunk({ status: 'inactive' });
      vi.mocked(repo.deactivate).mockResolvedValue(trunk);
      expect(await service.deactivate(TRUNK_ID, TENANT_ID)).toBe(trunk);
    });

    it('throws SipTrunkNotFoundError when repo returns null', async () => {
      vi.mocked(repo.deactivate).mockResolvedValue(null);
      await expect(service.deactivate(TRUNK_ID, TENANT_ID)).rejects.toThrow(SipTrunkNotFoundError);
    });
  });
});
