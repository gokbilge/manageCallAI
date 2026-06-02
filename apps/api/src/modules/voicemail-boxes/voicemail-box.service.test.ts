import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  VoicemailBoxService,
  VoicemailBoxNotFoundError,
  VoicemailBoxInputError,
} from './voicemail-box.service.js';
import type { VoicemailBoxRepository } from './voicemail-box.repository.js';
import type { VoicemailBox } from './voicemail-box.types.js';

const TENANT_ID  = '00000000-0000-0000-0000-000000000001';
const BOX_ID     = '00000000-0000-0000-0000-000000000010';
const PROMPT_ID  = '00000000-0000-0000-0000-000000000020';
const now = new Date();

function makeBox(overrides: Partial<VoicemailBox> = {}): VoicemailBox {
  return {
    id: BOX_ID,
    tenant_id: TENANT_ID,
    name: 'Sales',
    description: null,
    mailbox_number: '3001',
    greeting_prompt_id: null,
    greeting_prompt_name: null,
    greeting_prompt_uri: null,
    status: 'active',
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function makeMockRepo(): VoicemailBoxRepository {
  return {
    findAllByTenant: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
    findActivePrompt: vi.fn(),
  } as unknown as VoicemailBoxRepository;
}

describe('VoicemailBoxService', () => {
  let repo: VoicemailBoxRepository;
  let service: VoicemailBoxService;

  beforeEach(() => {
    repo = makeMockRepo();
    service = new VoicemailBoxService(repo);
  });

  describe('listByTenant', () => {
    it('delegates to repo', async () => {
      const boxes = [makeBox()];
      vi.mocked(repo.findAllByTenant).mockResolvedValue(boxes);
      expect(await service.listByTenant(TENANT_ID)).toBe(boxes);
    });
  });

  describe('getById', () => {
    it('returns box when found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(makeBox());
      await expect(service.getById(BOX_ID, TENANT_ID)).resolves.toBeDefined();
    });

    it('throws VoicemailBoxNotFoundError when not found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);
      await expect(service.getById(BOX_ID, TENANT_ID)).rejects.toThrow(VoicemailBoxNotFoundError);
    });
  });

  describe('create — mailbox_number validation', () => {
    it('accepts a valid 4-digit mailbox number', async () => {
      vi.mocked(repo.create).mockResolvedValue(makeBox());
      await expect(service.create({
        tenant_id: TENANT_ID,
        name: 'Sales',
        mailbox_number: '3001',
      })).resolves.toBeDefined();
    });

    it('accepts the minimum 2-digit mailbox number', async () => {
      vi.mocked(repo.create).mockResolvedValue(makeBox({ mailbox_number: '10' }));
      await expect(service.create({ tenant_id: TENANT_ID, name: 'S', mailbox_number: '10' })).resolves.toBeDefined();
    });

    it('accepts a 12-digit mailbox number', async () => {
      vi.mocked(repo.create).mockResolvedValue(makeBox({ mailbox_number: '123456789012' }));
      await expect(service.create({ tenant_id: TENANT_ID, name: 'S', mailbox_number: '123456789012' })).resolves.toBeDefined();
    });

    it('rejects a 1-digit mailbox number', async () => {
      await expect(service.create({ tenant_id: TENANT_ID, name: 'S', mailbox_number: '9' }))
        .rejects.toThrow(VoicemailBoxInputError);
    });

    it('rejects a 13-digit mailbox number', async () => {
      await expect(service.create({ tenant_id: TENANT_ID, name: 'S', mailbox_number: '1234567890123' }))
        .rejects.toThrow(VoicemailBoxInputError);
    });

    it('rejects non-numeric mailbox number', async () => {
      await expect(service.create({ tenant_id: TENANT_ID, name: 'S', mailbox_number: 'abc1' }))
        .rejects.toThrow(VoicemailBoxInputError);
    });
  });

  describe('create — greeting_prompt_id validation', () => {
    it('creates without greeting_prompt_id', async () => {
      vi.mocked(repo.create).mockResolvedValue(makeBox());
      await expect(service.create({ tenant_id: TENANT_ID, name: 'S', mailbox_number: '1000' })).resolves.toBeDefined();
      expect(repo.findActivePrompt).not.toHaveBeenCalled();
    });

    it('creates with null greeting_prompt_id without calling findActivePrompt', async () => {
      vi.mocked(repo.create).mockResolvedValue(makeBox());
      await service.create({ tenant_id: TENANT_ID, name: 'S', mailbox_number: '1000', greeting_prompt_id: null });
      expect(repo.findActivePrompt).not.toHaveBeenCalled();
    });

    it('validates greeting_prompt_id when provided', async () => {
      vi.mocked(repo.findActivePrompt).mockResolvedValue({ id: PROMPT_ID, storage_uri: null });
      vi.mocked(repo.create).mockResolvedValue(makeBox({ greeting_prompt_id: PROMPT_ID }));

      await service.create({ tenant_id: TENANT_ID, name: 'S', mailbox_number: '1000', greeting_prompt_id: PROMPT_ID });

      expect(repo.findActivePrompt).toHaveBeenCalledWith(PROMPT_ID, TENANT_ID);
    });

    it('throws VoicemailBoxInputError when prompt not found', async () => {
      vi.mocked(repo.findActivePrompt).mockResolvedValue(null);
      await expect(service.create({ tenant_id: TENANT_ID, name: 'S', mailbox_number: '1000', greeting_prompt_id: PROMPT_ID }))
        .rejects.toThrow(VoicemailBoxInputError);
    });
  });

  describe('update', () => {
    it('validates mailbox_number when provided', async () => {
      await expect(service.update(BOX_ID, TENANT_ID, { mailbox_number: 'bad' }))
        .rejects.toThrow(VoicemailBoxInputError);
    });

    it('skips mailbox_number validation when not provided', async () => {
      vi.mocked(repo.update).mockResolvedValue(makeBox({ name: 'Updated' }));
      await expect(service.update(BOX_ID, TENANT_ID, { name: 'Updated' })).resolves.toBeDefined();
    });

    it('validates greeting_prompt_id when present in update', async () => {
      vi.mocked(repo.findActivePrompt).mockResolvedValue(null);
      await expect(service.update(BOX_ID, TENANT_ID, { greeting_prompt_id: PROMPT_ID }))
        .rejects.toThrow(VoicemailBoxInputError);
    });

    it('skips greeting_prompt validation when key is absent from input', async () => {
      vi.mocked(repo.update).mockResolvedValue(makeBox());
      await service.update(BOX_ID, TENANT_ID, { name: 'X' });
      expect(repo.findActivePrompt).not.toHaveBeenCalled();
    });

    it('throws VoicemailBoxNotFoundError when repo returns null', async () => {
      vi.mocked(repo.update).mockResolvedValue(null);
      await expect(service.update(BOX_ID, TENANT_ID, { name: 'X' })).rejects.toThrow(VoicemailBoxNotFoundError);
    });
  });

  describe('deactivate', () => {
    it('returns deactivated box', async () => {
      vi.mocked(repo.deactivate).mockResolvedValue(makeBox({ status: 'inactive' }));
      expect((await service.deactivate(BOX_ID, TENANT_ID)).status).toBe('inactive');
    });

    it('throws VoicemailBoxNotFoundError when not found', async () => {
      vi.mocked(repo.deactivate).mockResolvedValue(null);
      await expect(service.deactivate(BOX_ID, TENANT_ID)).rejects.toThrow(VoicemailBoxNotFoundError);
    });
  });
});
