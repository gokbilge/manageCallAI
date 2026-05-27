import type { PhoneNumberRepository } from './phone-number.repository.js';
import type {
  CreatePhoneNumberInput,
  PhoneNumber,
  UpdatePhoneNumberInput,
} from './phone-number.types.js';

export class PhoneNumberNotFoundError extends Error {
  constructor(id: string) {
    super(`Phone number not found: ${id}`);
    this.name = 'PhoneNumberNotFoundError';
  }
}

export class PhoneNumberService {
  constructor(private readonly repo: PhoneNumberRepository) {}

  listByTenant(tenantId: string): Promise<PhoneNumber[]> {
    return this.repo.findAllByTenant(tenantId);
  }

  async getById(id: string, tenantId: string): Promise<PhoneNumber> {
    const number = await this.repo.findById(id, tenantId);
    if (!number) throw new PhoneNumberNotFoundError(id);
    return number;
  }

  create(input: CreatePhoneNumberInput): Promise<PhoneNumber> {
    return this.repo.create(input);
  }

  async update(id: string, tenantId: string, input: UpdatePhoneNumberInput): Promise<PhoneNumber> {
    const number = await this.repo.update(id, tenantId, input);
    if (!number) throw new PhoneNumberNotFoundError(id);
    return number;
  }

  async deactivate(id: string, tenantId: string): Promise<PhoneNumber> {
    const number = await this.repo.deactivate(id, tenantId);
    if (!number) throw new PhoneNumberNotFoundError(id);
    return number;
  }
}
