import bcrypt from 'bcryptjs';
import type { TenantUser, UpdateUserInput } from './user.types.js';
import { TENANT_ROLES } from './user.types.js';
import type { UserRepository } from './user.repository.js';

const BCRYPT_ROUNDS = 12;

export class UserNotFoundError extends Error {
  constructor(id: string) {
    super(`User not found: ${id}`);
    this.name = 'UserNotFoundError';
  }
}

export class UserConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserConflictError';
  }
}

export class UserOperationForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserOperationForbiddenError';
  }
}

export class UserService {
  constructor(private readonly repo: UserRepository) {}

  async listByTenant(tenantId: string): Promise<TenantUser[]> {
    return this.repo.listByTenant(tenantId);
  }

  async getById(id: string, tenantId: string): Promise<TenantUser> {
    const user = await this.repo.findById(id, tenantId);
    if (!user) throw new UserNotFoundError(id);
    return user;
  }

  async create(tenantId: string, input: { email: string; display_name: string; role: string; password: string }): Promise<TenantUser> {
    if (!TENANT_ROLES.includes(input.role as never)) {
      throw new UserOperationForbiddenError(`Invalid role: ${input.role}`);
    }
    const password_hash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    try {
      return await this.repo.create({
        tenant_id: tenantId,
        email: input.email,
        display_name: input.display_name,
        role: input.role as (typeof TENANT_ROLES)[number],
        password_hash,
      });
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        throw new UserConflictError(`Email already exists in this tenant: ${input.email}`);
      }
      throw err;
    }
  }

  async update(id: string, tenantId: string, actorId: string, input: UpdateUserInput): Promise<TenantUser> {
    if (input.role !== undefined && id === actorId) {
      throw new UserOperationForbiddenError('You cannot change your own role');
    }
    if (input.role !== undefined && !TENANT_ROLES.includes(input.role)) {
      throw new UserOperationForbiddenError(`Invalid role: ${input.role}`);
    }
    const updated = await this.repo.update(id, tenantId, input);
    if (!updated) throw new UserNotFoundError(id);
    return updated;
  }

  async deactivate(id: string, tenantId: string, actorId: string): Promise<TenantUser> {
    if (id === actorId) {
      throw new UserOperationForbiddenError('You cannot deactivate your own account');
    }
    const updated = await this.repo.deactivate(id, tenantId);
    if (!updated) throw new UserNotFoundError(id);
    return updated;
  }
}
