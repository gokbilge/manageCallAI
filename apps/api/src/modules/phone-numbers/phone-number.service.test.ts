import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PhoneNumberService, PhoneNumberNotFoundError } from './phone-number.service.js';
import type { PhoneNumberRepository } from './phone-number.repository.js';
import type { PhoneNumber } from './phone-number.types.js';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const NUMBER_ID  = '00000000-0000-0000-0000-000000000010';
const now = new Date();

function makeNumber(overrides: Partial<PhoneNumber> = {}): PhoneNumber {
  return {
    id: NUMBER_ID,
    tenant_id: TENANT_ID,
    number: '+15551234567',
    label: 'Main line',
    status: 'active',
    inbound_route_id: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function makeMockRepo(): PhoneNumberRepository {
  return {
    findAllByTenant: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deactivate: vi.fn(),
  } as unknown as PhoneNumberRepository;
}

describe('PhoneNumberService', () => {
  let repo: PhoneNumberRepository;
  let service: PhoneNumberService;

  beforeEach(() => {
    repo = makeMockRepo();
    service = new PhoneNumberService(repo);
  });

  describe('listByTenant', () => {
    it('delegates to repo', async () => {
      const numbers = [makeNumber()];
      vi.mocked(repo.findAllByTenant).mockResolvedValue(numbers);
      expect(await service.listByTenant(TENANT_ID)).toBe(numbers);
      expect(repo.findAllByTenant).toHaveBeenCalledWith(TENANT_ID);
    });
  });

  describe('getById', () => {
    it('returns phone number when found', async () => {
      const number = makeNumber();
      vi.mocked(repo.findById).mockResolvedValue(number);
      expect(await service.getById(NUMBER_ID, TENANT_ID)).toBe(number);
    });

    it('throws PhoneNumberNotFoundError when not found', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);
      await expect(service.getById(NUMBER_ID, TENANT_ID)).rejects.toThrow(PhoneNumberNotFoundError);
    });

    it('includes the id in the error message', async () => {
      vi.mocked(repo.findById).mockResolvedValue(null);
      await expect(service.getById(NUMBER_ID, TENANT_ID)).rejects.toThrow(NUMBER_ID);
    });
  });

  describe('create', () => {
    it('delegates to repo and returns result', async () => {
      const number = makeNumber();
      vi.mocked(repo.create).mockResolvedValue(number);
      const input = { tenant_id: TENANT_ID, number: '+15551234567', label: 'Main line' };
      expect(await service.create(input)).toBe(number);
      expect(repo.create).toHaveBeenCalledWith(input);
    });
  });

  describe('update', () => {
    it('returns updated phone number', async () => {
      const updated = makeNumber({ label: 'New label' });
      vi.mocked(repo.update).mockResolvedValue(updated);
      expect(await service.update(NUMBER_ID, TENANT_ID, { label: 'New label' })).toBe(updated);
    });

    it('throws PhoneNumberNotFoundError when repo returns null', async () => {
      vi.mocked(repo.update).mockResolvedValue(null);
      await expect(service.update(NUMBER_ID, TENANT_ID, { label: 'X' })).rejects.toThrow(PhoneNumberNotFoundError);
    });
  });

  describe('deactivate', () => {
    it('returns deactivated phone number', async () => {
      const deactivated = makeNumber({ status: 'inactive' });
      vi.mocked(repo.deactivate).mockResolvedValue(deactivated);
      expect(await service.deactivate(NUMBER_ID, TENANT_ID)).toBe(deactivated);
    });

    it('throws PhoneNumberNotFoundError when repo returns null', async () => {
      vi.mocked(repo.deactivate).mockResolvedValue(null);
      await expect(service.deactivate(NUMBER_ID, TENANT_ID)).rejects.toThrow(PhoneNumberNotFoundError);
    });
  });
});
