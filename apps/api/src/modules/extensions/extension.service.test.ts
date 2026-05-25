import { describe, it, expect, vi } from 'vitest';
import { ExtensionService, ExtensionNotFoundError } from './extension.service.js';
import type { ExtensionRepository } from './extension.repository.js';
import type { Extension } from './extension.types.js';

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
  default_destination_type: null,
  default_destination_id: null,
  created_at: new Date(),
  updated_at: new Date(),
};
const tenantId = sampleExt.tenant_id;

describe('ExtensionService', () => {
  it('getById returns extension when found', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(sampleExt);
    await expect(service.getById(sampleExt.id, tenantId)).resolves.toEqual(sampleExt);
  });

  it('getById throws ExtensionNotFoundError when not found', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null);
    await expect(service.getById('missing-id', tenantId)).rejects.toThrow(ExtensionNotFoundError);
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

  it('create delegates to repo', async () => {
    vi.mocked(mockRepo.create).mockResolvedValue(sampleExt);
    const result = await service.create({
      tenant_id: sampleExt.tenant_id,
      extension_number: sampleExt.extension_number,
      display_name: sampleExt.display_name,
    });
    expect(result).toEqual(sampleExt);
  });
});
