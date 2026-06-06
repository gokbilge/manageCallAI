import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DispositionsService, DispositionCodeNotFoundError, DispositionValidationError, CallNoteNotFoundError } from './dispositions.service.js';
import type { DispositionsRepository } from './dispositions.repository.js';
import type { DispositionCode, CallDisposition, CallNote } from './dispositions.types.js';

function makeCode(overrides: Partial<DispositionCode> = {}): DispositionCode {
  return {
    id: 'code-1',
    tenant_id: 'tenant-1',
    code: 'RESOLVED',
    label: 'Resolved',
    description: null,
    queue_id: null,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeNote(overrides: Partial<CallNote> = {}): CallNote {
  return {
    id: 'note-1',
    tenant_id: 'tenant-1',
    call_id: 'call-1',
    author_user_id: 'user-1',
    content: 'Good call',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function makeRepo(): DispositionsRepository {
  return {
    listCodes: vi.fn(),
    findCodeById: vi.fn(),
    codeExistsByCode: vi.fn(),
    createCode: vi.fn(),
    updateCode: vi.fn(),
    findDispositionByCallId: vi.fn(),
    listDispositionsByAgent: vi.fn(),
    upsertDisposition: vi.fn(),
    listNotesByCall: vi.fn(),
    findNoteById: vi.fn(),
    createNote: vi.fn(),
    updateNote: vi.fn(),
    deleteNote: vi.fn(),
  } as unknown as DispositionsRepository;
}

describe('DispositionsService', () => {
  let repo: DispositionsRepository;
  let service: DispositionsService;

  beforeEach(() => {
    repo = makeRepo();
    service = new DispositionsService(repo);
  });

  describe('createCode', () => {
    it('throws if code already exists', async () => {
      vi.mocked(repo.codeExistsByCode).mockResolvedValue(true);
      await expect(service.createCode({ tenant_id: 't1', code: 'X', label: 'X' }))
        .rejects.toThrow(DispositionValidationError);
    });

    it('creates code when unique', async () => {
      const code = makeCode();
      vi.mocked(repo.codeExistsByCode).mockResolvedValue(false);
      vi.mocked(repo.createCode).mockResolvedValue(code);
      const result = await service.createCode({ tenant_id: 't1', code: 'RESOLVED', label: 'Resolved' });
      expect(result).toBe(code);
    });
  });

  describe('updateCode', () => {
    it('throws not found when missing', async () => {
      vi.mocked(repo.updateCode).mockResolvedValue(null);
      await expect(service.updateCode('id', 'tenant', { label: 'New' }))
        .rejects.toThrow(DispositionCodeNotFoundError);
    });

    it('throws validation for empty label', async () => {
      await expect(service.updateCode('id', 'tenant', { label: '  ' }))
        .rejects.toThrow(DispositionValidationError);
    });
  });

  describe('recordDisposition', () => {
    it('throws when code not found', async () => {
      vi.mocked(repo.findCodeById).mockResolvedValue(null);
      await expect(service.recordDisposition('t1', { call_id: 'c1', disposition_code_id: 'x' }, 'u1'))
        .rejects.toThrow(DispositionCodeNotFoundError);
    });

    it('throws when code is inactive', async () => {
      vi.mocked(repo.findCodeById).mockResolvedValue(makeCode({ is_active: false }));
      await expect(service.recordDisposition('t1', { call_id: 'c1', disposition_code_id: 'x' }, 'u1'))
        .rejects.toThrow(DispositionValidationError);
    });

    it('upserts disposition when code is active', async () => {
      const code = makeCode();
      const disp = { id: 'd1', tenant_id: 't1', call_id: 'c1', disposition_code_id: code.id, agent_profile_id: null, recorded_by: 'u1', note: null, created_at: new Date(), updated_at: new Date() } as CallDisposition;
      vi.mocked(repo.findCodeById).mockResolvedValue(code);
      vi.mocked(repo.upsertDisposition).mockResolvedValue(disp);
      const result = await service.recordDisposition('t1', { call_id: 'c1', disposition_code_id: code.id }, 'u1');
      expect(result).toBe(disp);
    });
  });

  describe('createNote', () => {
    it('throws for empty content', async () => {
      await expect(service.createNote('t1', 'u1', { call_id: 'c1', content: '  ' }))
        .rejects.toThrow(DispositionValidationError);
    });

    it('creates note', async () => {
      const note = makeNote();
      vi.mocked(repo.createNote).mockResolvedValue(note);
      const result = await service.createNote('t1', 'u1', { call_id: 'c1', content: 'Good call' });
      expect(result).toBe(note);
    });
  });

  describe('updateNote', () => {
    it('throws not found when note missing or not owned', async () => {
      vi.mocked(repo.updateNote).mockResolvedValue(null);
      await expect(service.updateNote('n1', 't1', 'u1', { content: 'x' }))
        .rejects.toThrow(CallNoteNotFoundError);
    });
  });

  describe('deleteNote', () => {
    it('throws not found when note missing or not owned', async () => {
      vi.mocked(repo.deleteNote).mockResolvedValue(false);
      await expect(service.deleteNote('n1', 't1', 'u1'))
        .rejects.toThrow(CallNoteNotFoundError);
    });
  });
});
