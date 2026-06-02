import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RetentionService, RetentionBoundsError, LegalHoldNotFoundError } from './retention.service.js';
import type { RetentionRepository } from './retention.repository.js';
import type { LegalHold, RetentionPolicy } from './retention.types.js';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const HOLD_ID   = '00000000-0000-0000-0000-000000000010';

function makePolicy(overrides: Partial<RetentionPolicy> = {}): RetentionPolicy {
  return {
    tenant_id: TENANT_ID,
    recording_retention_days: 90,
    voicemail_retention_days: 90,
    transcript_retention_days: 90,
    ai_summary_retention_days: 90,
    cdr_retention_days: 365,
    call_event_retention_days: 90,
    generated_media_retention_days: 90,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeLegalHold(overrides: Partial<LegalHold> = {}): LegalHold {
  return {
    id: HOLD_ID,
    tenant_id: TENANT_ID,
    resource_type: 'recording',
    resource_id: null,
    initiated_by: 'admin@example.com',
    case_reference: 'CASE-001',
    reason: 'Litigation hold',
    status: 'active',
    released_by: null,
    released_at: null,
    expires_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeMockRepo(): RetentionRepository {
  return {
    getPolicy: vi.fn(),
    upsertPolicy: vi.fn(),
    listLegalHolds: vi.fn(),
    createLegalHold: vi.fn(),
    releaseLegalHold: vi.fn(),
  } as unknown as RetentionRepository;
}

describe('RetentionService', () => {
  let repo: RetentionRepository;
  let service: RetentionService;

  beforeEach(() => {
    repo = makeMockRepo();
    service = new RetentionService(repo);
  });

  describe('getPolicy', () => {
    it('returns policy when found', async () => {
      const policy = makePolicy();
      vi.mocked(repo.getPolicy).mockResolvedValue(policy);
      expect(await service.getPolicy(TENANT_ID)).toBe(policy);
    });

    it('returns null when no policy exists', async () => {
      vi.mocked(repo.getPolicy).mockResolvedValue(null);
      expect(await service.getPolicy(TENANT_ID)).toBeNull();
    });
  });

  describe('updatePolicy — bounds validation', () => {
    it('accepts valid recording_retention_days (1–2555)', async () => {
      vi.mocked(repo.upsertPolicy).mockResolvedValue(makePolicy({ recording_retention_days: 180 }));
      await expect(service.updatePolicy(TENANT_ID, { recording_retention_days: 180 })).resolves.toBeDefined();
    });

    it('accepts cdr_retention_days at minimum (30)', async () => {
      vi.mocked(repo.upsertPolicy).mockResolvedValue(makePolicy({ cdr_retention_days: 30 }));
      await expect(service.updatePolicy(TENANT_ID, { cdr_retention_days: 30 })).resolves.toBeDefined();
    });

    it('accepts call_event_retention_days at minimum (7)', async () => {
      vi.mocked(repo.upsertPolicy).mockResolvedValue(makePolicy({ call_event_retention_days: 7 }));
      await expect(service.updatePolicy(TENANT_ID, { call_event_retention_days: 7 })).resolves.toBeDefined();
    });

    it('rejects recording_retention_days = 0 (below min of 1)', async () => {
      await expect(service.updatePolicy(TENANT_ID, { recording_retention_days: 0 }))
        .rejects.toThrow(RetentionBoundsError);
    });

    it('rejects recording_retention_days = 2556 (above max of 2555)', async () => {
      await expect(service.updatePolicy(TENANT_ID, { recording_retention_days: 2556 }))
        .rejects.toThrow(RetentionBoundsError);
    });

    it('rejects cdr_retention_days = 29 (below min of 30)', async () => {
      await expect(service.updatePolicy(TENANT_ID, { cdr_retention_days: 29 }))
        .rejects.toThrow(RetentionBoundsError);
    });

    it('rejects call_event_retention_days = 6 (below min of 7)', async () => {
      await expect(service.updatePolicy(TENANT_ID, { call_event_retention_days: 6 }))
        .rejects.toThrow(RetentionBoundsError);
    });

    it('includes field name and value in error message', async () => {
      await expect(service.updatePolicy(TENANT_ID, { recording_retention_days: 0 }))
        .rejects.toThrow('recording_retention_days');
    });

    it('skips null values without throwing', async () => {
      vi.mocked(repo.upsertPolicy).mockResolvedValue(makePolicy());
      await expect(service.updatePolicy(TENANT_ID, { recording_retention_days: null })).resolves.toBeDefined();
    });
  });

  describe('listLegalHolds', () => {
    it('returns active holds by default', async () => {
      const holds = [makeLegalHold()];
      vi.mocked(repo.listLegalHolds).mockResolvedValue(holds);
      expect(await service.listLegalHolds(TENANT_ID)).toBe(holds);
      expect(repo.listLegalHolds).toHaveBeenCalledWith(TENANT_ID, true);
    });

    it('passes activeOnly=false when requested', async () => {
      vi.mocked(repo.listLegalHolds).mockResolvedValue([]);
      await service.listLegalHolds(TENANT_ID, false);
      expect(repo.listLegalHolds).toHaveBeenCalledWith(TENANT_ID, false);
    });
  });

  describe('createLegalHold', () => {
    it('delegates to repo and returns hold', async () => {
      const hold = makeLegalHold();
      vi.mocked(repo.createLegalHold).mockResolvedValue(hold);
      const input = {
        resource_type: 'recording' as const,
        initiated_by: 'admin@example.com',
        reason: 'Litigation hold',
      };
      expect(await service.createLegalHold(TENANT_ID, input)).toBe(hold);
      expect(repo.createLegalHold).toHaveBeenCalledWith(TENANT_ID, input);
    });
  });

  describe('releaseLegalHold', () => {
    it('returns released hold', async () => {
      const released = makeLegalHold({ status: 'released', released_by: 'admin' });
      vi.mocked(repo.releaseLegalHold).mockResolvedValue(released);
      expect(await service.releaseLegalHold(HOLD_ID, TENANT_ID, 'admin')).toBe(released);
    });

    it('throws LegalHoldNotFoundError when repo returns null', async () => {
      vi.mocked(repo.releaseLegalHold).mockResolvedValue(null);
      await expect(service.releaseLegalHold(HOLD_ID, TENANT_ID, 'admin')).rejects.toThrow(LegalHoldNotFoundError);
    });
  });
});
