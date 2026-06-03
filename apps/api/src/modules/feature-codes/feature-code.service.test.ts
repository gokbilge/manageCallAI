import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  FeatureCodeService,
  FeatureCodeNotFoundError,
  FeatureCodeConflictError,
  FeatureCodeStateError,
} from './feature-code.service.js';
import type { FeatureCodeRepository } from './feature-code.repository.js';
import type { FeatureCode } from './feature-code.types.js';

const makeFC = (overrides: Partial<FeatureCode> = {}): FeatureCode => ({
  id: 'fc-1',
  tenant_id: 'tenant-1',
  code: '*72',
  name: 'Enable Call Forward',
  description: null,
  action_type: 'call_forward_enable',
  action_config: {},
  status: 'draft',
  requires_approval: false,
  created_by: 'user-1',
  created_at: new Date(),
  updated_at: new Date(),
  published_at: null,
  ...overrides,
});

function makeRepo(overrides: Partial<FeatureCodeRepository> = {}): FeatureCodeRepository {
  return {
    findAllByTenant: vi.fn().mockResolvedValue([makeFC()]),
    findById: vi.fn().mockResolvedValue(makeFC()),
    findByCode: vi.fn().mockResolvedValue(null),
    findActiveByTenant: vi.fn().mockResolvedValue([makeFC({ status: 'active' })]),
    create: vi.fn().mockResolvedValue(makeFC()),
    update: vi.fn().mockResolvedValue(makeFC()),
    publish: vi.fn().mockResolvedValue(makeFC({ status: 'active', published_at: new Date() })),
    disable: vi.fn().mockResolvedValue(makeFC({ status: 'disabled' })),
    delete: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as unknown as FeatureCodeRepository;
}

describe('FeatureCodeService', () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: FeatureCodeService;

  beforeEach(() => {
    repo = makeRepo();
    service = new FeatureCodeService(repo);
  });

  describe('create', () => {
    it('creates a feature code successfully', async () => {
      const fc = await service.create({
        tenant_id: 'tenant-1',
        code: '*72',
        name: 'Enable Call Forward',
        action_type: 'call_forward_enable',
        created_by: 'user-1',
      });
      expect(fc.code).toBe('*72');
      expect(vi.mocked(repo.create)).toHaveBeenCalled();
    });

    it('rejects duplicate code within same tenant', async () => {
      repo = makeRepo({ findByCode: vi.fn().mockResolvedValue(makeFC()) });
      service = new FeatureCodeService(repo);
      await expect(
        service.create({ tenant_id: 'tenant-1', code: '*72', name: 'Dup', action_type: 'call_forward_enable' }),
      ).rejects.toThrow(FeatureCodeConflictError);
    });

    it('rejects emergency number codes', async () => {
      await expect(
        service.create({ tenant_id: 'tenant-1', code: '911', name: 'Bad', action_type: 'voicemail_access' }),
      ).rejects.toThrow(FeatureCodeConflictError);
    });

    it('rejects *911 (shadows emergency)', async () => {
      await expect(
        service.create({ tenant_id: 'tenant-1', code: '*911', name: 'Bad', action_type: 'voicemail_access' }),
      ).rejects.toThrow(FeatureCodeConflictError);
    });

    it('rejects empty code', async () => {
      await expect(
        service.create({ tenant_id: 'tenant-1', code: '', name: 'Bad', action_type: 'voicemail_access' }),
      ).rejects.toThrow(FeatureCodeConflictError);
    });

    it('accepts *72 (not an emergency number)', async () => {
      await expect(
        service.create({ tenant_id: 'tenant-1', code: '*72', name: 'OK', action_type: 'call_forward_enable' }),
      ).resolves.toBeDefined();
    });
  });

  describe('update', () => {
    it('updates a draft feature code', async () => {
      const fc = await service.update('fc-1', 'tenant-1', { name: 'Updated' });
      expect(fc).toBeDefined();
    });

    it('throws FeatureCodeStateError when updating non-draft code', async () => {
      repo = makeRepo({ findById: vi.fn().mockResolvedValue(makeFC({ status: 'active' })) });
      service = new FeatureCodeService(repo);
      await expect(service.update('fc-1', 'tenant-1', { name: 'Bad' })).rejects.toThrow(FeatureCodeStateError);
    });

    it('throws FeatureCodeNotFoundError when code not found', async () => {
      repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
      service = new FeatureCodeService(repo);
      await expect(service.update('missing', 'tenant-1', { name: 'Bad' })).rejects.toThrow(FeatureCodeNotFoundError);
    });
  });

  describe('publish', () => {
    it('publishes a draft code', async () => {
      const fc = await service.publish('fc-1', 'tenant-1');
      expect(fc.status).toBe('active');
    });

    it('rejects publish when not in draft', async () => {
      repo = makeRepo({ findById: vi.fn().mockResolvedValue(makeFC({ status: 'active' })) });
      service = new FeatureCodeService(repo);
      await expect(service.publish('fc-1', 'tenant-1')).rejects.toThrow(FeatureCodeStateError);
    });
  });

  describe('disable', () => {
    it('disables an active code', async () => {
      repo = makeRepo({
        findById: vi.fn().mockResolvedValue(makeFC({ status: 'active' })),
        disable: vi.fn().mockResolvedValue(makeFC({ status: 'disabled' })),
      });
      service = new FeatureCodeService(repo);
      const fc = await service.disable('fc-1', 'tenant-1');
      expect(fc.status).toBe('disabled');
    });

    it('rejects disabling a non-active code', async () => {
      await expect(service.disable('fc-1', 'tenant-1')).rejects.toThrow(FeatureCodeStateError);
    });
  });

  describe('delete', () => {
    it('deletes a draft code', async () => {
      await expect(service.delete('fc-1', 'tenant-1')).resolves.toBeUndefined();
    });

    it('rejects deleting an active code', async () => {
      repo = makeRepo({ findById: vi.fn().mockResolvedValue(makeFC({ status: 'active' })) });
      service = new FeatureCodeService(repo);
      await expect(service.delete('fc-1', 'tenant-1')).rejects.toThrow(FeatureCodeStateError);
    });
  });

  describe('resolveForRuntime', () => {
    it('returns active feature code for runtime lookup', async () => {
      repo = makeRepo({
        findByCode: vi.fn().mockResolvedValue(makeFC({ status: 'active' })),
      });
      service = new FeatureCodeService(repo);
      const fc = await service.resolveForRuntime('*72', 'tenant-1');
      expect(fc).not.toBeNull();
      expect(fc?.status).toBe('active');
    });

    it('returns null for inactive codes', async () => {
      repo = makeRepo({
        findByCode: vi.fn().mockResolvedValue(makeFC({ status: 'draft' })),
      });
      service = new FeatureCodeService(repo);
      const fc = await service.resolveForRuntime('*72', 'tenant-1');
      expect(fc).toBeNull();
    });

    it('returns null when code not found', async () => {
      const fc = await service.resolveForRuntime('*99', 'tenant-1');
      expect(fc).toBeNull();
    });
  });

  describe('validate', () => {
    it('returns valid for a publishable draft code', async () => {
      const result = await service.validate('fc-1', 'tenant-1');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns invalid when code is not in draft status', async () => {
      repo = makeRepo({ findById: vi.fn().mockResolvedValue(makeFC({ status: 'active' })) });
      service = new FeatureCodeService(repo);
      const result = await service.validate('fc-1', 'tenant-1');
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    it('returns invalid when code shadows emergency number', async () => {
      repo = makeRepo({ findById: vi.fn().mockResolvedValue(makeFC({ code: '911' })) });
      service = new FeatureCodeService(repo);
      const result = await service.validate('fc-1', 'tenant-1');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('emergency'))).toBe(true);
    });

    it('throws FeatureCodeNotFoundError when code does not exist', async () => {
      repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) });
      service = new FeatureCodeService(repo);
      await expect(service.validate('missing', 'tenant-1')).rejects.toThrow(FeatureCodeNotFoundError);
    });
  });

  describe('isAllowedActionType', () => {
    it('validates allowed action types', () => {
      expect(FeatureCodeService.isAllowedActionType('voicemail_access')).toBe(true);
      expect(FeatureCodeService.isAllowedActionType('call_forward_enable')).toBe(true);
      expect(FeatureCodeService.isAllowedActionType('dnd_enable')).toBe(true);
      expect(FeatureCodeService.isAllowedActionType('conference_join')).toBe(true);
    });

    it('rejects unknown action types', () => {
      expect(FeatureCodeService.isAllowedActionType('shell_exec')).toBe(false);
      expect(FeatureCodeService.isAllowedActionType('')).toBe(false);
      expect(FeatureCodeService.isAllowedActionType('rm -rf /')).toBe(false);
    });
  });
});
