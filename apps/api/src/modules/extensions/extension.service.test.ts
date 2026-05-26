import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExtensionService, ExtensionNotFoundError } from './extension.service.js';
import type { ExtensionRepository } from './extension.repository.js';
import type { CreateExtensionRepoInput, Extension, UpdateExtensionRepoInput } from './extension.types.js';

vi.mock('../../crypto/sip-secret.js', () => ({
  encryptSipPassword: (pw: string) => ({ ciphertext: `enc:${pw}`, keyId: 'test-v1' }),
}));

const mockRepo = {
  findAllByTenant: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  deactivate: vi.fn(),
} as unknown as ExtensionRepository;

const service = new ExtensionService(mockRepo);

const sampleExt: Extension = {
  id: '00000000-0000-0000-0000-000000000001',
  tenant_id: '00000000-0000-0000-0000-000000000002',
  extension_number: '100',
  display_name: 'Reception',
  status: 'active',
  sip_username: '100',
  default_destination_type: null,
  default_destination_id: null,
  created_at: new Date(),
  updated_at: new Date(),
};
const tenantId = sampleExt.tenant_id;

beforeEach(() => vi.clearAllMocks());

describe('ExtensionService', () => {
  it('getById returns extension when found', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(sampleExt);
    await expect(service.getById(sampleExt.id, tenantId)).resolves.toEqual(sampleExt);
  });

  it('getById throws ExtensionNotFoundError when not found', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null);
    await expect(service.getById('missing-id', tenantId)).rejects.toThrow(ExtensionNotFoundError);
  });

  it('create encrypts sip_password before passing to repo', async () => {
    vi.mocked(mockRepo.create).mockResolvedValue(sampleExt);
    await service.create({
      tenant_id: tenantId,
      extension_number: '200',
      display_name: 'Test',
      sip_password: 'PlainPass123!',
    });
    const repoInput = vi.mocked(mockRepo.create).mock.calls[0]![0] as CreateExtensionRepoInput;
    expect(repoInput).not.toHaveProperty('sip_password');
    expect(repoInput.sip_password_ciphertext).toBe('enc:PlainPass123!');
    expect(repoInput.sip_password_key_id).toBe('test-v1');
  });

  it('create result does not expose any password field', async () => {
    vi.mocked(mockRepo.create).mockResolvedValue(sampleExt);
    const result = await service.create({
      tenant_id: tenantId,
      extension_number: '200',
      display_name: 'Test',
      sip_password: 'PlainPass123!',
    });
    expect(result).not.toHaveProperty('sip_password');
    expect(result).not.toHaveProperty('sip_password_ciphertext');
    expect(result).not.toHaveProperty('sip_password_key_id');
  });

  it('update encrypts sip_password when provided', async () => {
    vi.mocked(mockRepo.update).mockResolvedValue(sampleExt);
    await service.update(sampleExt.id, tenantId, { sip_password: 'NewPass456!' });
    const repoInput = vi.mocked(mockRepo.update).mock.calls[0]![2] as UpdateExtensionRepoInput;
    expect(repoInput).not.toHaveProperty('sip_password');
    expect(repoInput.sip_password_ciphertext).toBe('enc:NewPass456!');
    expect(repoInput.sip_password_key_id).toBe('test-v1');
  });

  it('update without sip_password omits encrypted fields', async () => {
    vi.mocked(mockRepo.update).mockResolvedValue(sampleExt);
    await service.update(sampleExt.id, tenantId, { display_name: 'Updated' });
    const repoInput = vi.mocked(mockRepo.update).mock.calls[0]![2] as UpdateExtensionRepoInput;
    expect(repoInput).not.toHaveProperty('sip_password');
    expect(repoInput).not.toHaveProperty('sip_password_ciphertext');
    expect(repoInput).not.toHaveProperty('sip_password_key_id');
  });

  it('update throws ExtensionNotFoundError when not found', async () => {
    vi.mocked(mockRepo.update).mockResolvedValue(null);
    await expect(service.update('missing-id', tenantId, { display_name: 'X' })).rejects.toThrow(
      ExtensionNotFoundError,
    );
  });

  it('deactivate throws ExtensionNotFoundError when not found', async () => {
    vi.mocked(mockRepo.deactivate).mockResolvedValue(null);
    await expect(service.deactivate('missing-id', tenantId)).rejects.toThrow(ExtensionNotFoundError);
  });

  it('deactivate returns deactivated extension', async () => {
    const deactivated = { ...sampleExt, status: 'inactive' as const };
    vi.mocked(mockRepo.deactivate).mockResolvedValue(deactivated);
    const result = await service.deactivate(sampleExt.id, tenantId);
    expect(result.status).toBe('inactive');
  });
});
