import { describe, expect, it, vi } from 'vitest';
import type { UserRepository } from './user.repository.js';
import {
  UserConflictError,
  UserNotFoundError,
  UserOperationForbiddenError,
  UserService,
} from './user.service.js';

const baseUser = {
  id: 'user-2',
  tenant_id: 'tenant-1',
  email: 'bob@acme.com',
  display_name: 'Bob',
  role: 'tenant_operator' as const,
  status: 'active',
  last_login_at: null,
  created_at: '2026-05-29T08:00:00Z',
  updated_at: '2026-05-29T08:00:00Z',
};

function makeMockRepo(): UserRepository {
  return {
    listByTenant: vi.fn().mockResolvedValue([baseUser]),
    findById: vi.fn().mockResolvedValue(baseUser),
    create: vi.fn().mockResolvedValue(baseUser),
    update: vi.fn().mockResolvedValue(baseUser),
    deactivate: vi.fn().mockResolvedValue({ ...baseUser, status: 'inactive' }),
  } as unknown as UserRepository;
}

describe('UserService', () => {
  describe('listByTenant', () => {
    it('returns users from repository', async () => {
      const repo = makeMockRepo();
      const service = new UserService(repo);
      const result = await service.listByTenant('tenant-1');
      expect(result).toHaveLength(1);
      expect(result[0]?.email).toBe('bob@acme.com');
    });
  });

  describe('getById', () => {
    it('returns user when found', async () => {
      const repo = makeMockRepo();
      const service = new UserService(repo);
      const result = await service.getById('user-2', 'tenant-1');
      expect(result.id).toBe('user-2');
    });

    it('throws UserNotFoundError when not found', async () => {
      const repo = makeMockRepo();
      vi.mocked(repo.findById).mockResolvedValueOnce(null);
      const service = new UserService(repo);
      await expect(service.getById('missing', 'tenant-1')).rejects.toBeInstanceOf(UserNotFoundError);
    });
  });

  describe('create', () => {
    it('hashes password and creates user', async () => {
      const repo = makeMockRepo();
      const service = new UserService(repo);
      const result = await service.create('tenant-1', {
        email: 'bob@acme.com',
        display_name: 'Bob',
        role: 'tenant_operator',
        password: 'secure-pass-1',
      });
      expect(result.email).toBe('bob@acme.com');
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'bob@acme.com', role: 'tenant_operator' }),
      );
      const call = vi.mocked(repo.create).mock.calls[0]![0];
      expect(call.password_hash).not.toBe('secure-pass-1');
    });

    it('throws UserConflictError on duplicate email', async () => {
      const repo = makeMockRepo();
      vi.mocked(repo.create).mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' }));
      const service = new UserService(repo);
      await expect(
        service.create('tenant-1', { email: 'bob@acme.com', display_name: 'Bob', role: 'tenant_operator', password: 'pw12345678' }),
      ).rejects.toBeInstanceOf(UserConflictError);
    });

    it('throws UserOperationForbiddenError for invalid role', async () => {
      const repo = makeMockRepo();
      const service = new UserService(repo);
      await expect(
        service.create('tenant-1', { email: 'x@x.com', display_name: 'X', role: 'platform_admin', password: 'pw12345678' }),
      ).rejects.toBeInstanceOf(UserOperationForbiddenError);
    });
  });

  describe('update', () => {
    it('updates display_name and role', async () => {
      const repo = makeMockRepo();
      const service = new UserService(repo);
      await service.update('user-2', 'tenant-1', 'actor-1', { display_name: 'Robert', role: 'tenant_viewer' });
      expect(repo.update).toHaveBeenCalledWith('user-2', 'tenant-1', { display_name: 'Robert', role: 'tenant_viewer' });
    });

    it('throws UserOperationForbiddenError when actor changes own role', async () => {
      const repo = makeMockRepo();
      const service = new UserService(repo);
      await expect(
        service.update('user-2', 'tenant-1', 'user-2', { role: 'tenant_viewer' }),
      ).rejects.toBeInstanceOf(UserOperationForbiddenError);
    });

    it('throws UserNotFoundError when user does not exist in tenant', async () => {
      const repo = makeMockRepo();
      vi.mocked(repo.update).mockResolvedValueOnce(null);
      const service = new UserService(repo);
      await expect(
        service.update('missing', 'tenant-1', 'actor-1', { display_name: 'X' }),
      ).rejects.toBeInstanceOf(UserNotFoundError);
    });
  });

  describe('deactivate', () => {
    it('deactivates a user', async () => {
      const repo = makeMockRepo();
      const service = new UserService(repo);
      const result = await service.deactivate('user-2', 'tenant-1', 'actor-1');
      expect(result.status).toBe('inactive');
    });

    it('throws UserOperationForbiddenError when actor deactivates self', async () => {
      const repo = makeMockRepo();
      const service = new UserService(repo);
      await expect(
        service.deactivate('user-2', 'tenant-1', 'user-2'),
      ).rejects.toBeInstanceOf(UserOperationForbiddenError);
    });

    it('throws UserNotFoundError when user does not exist', async () => {
      const repo = makeMockRepo();
      vi.mocked(repo.deactivate).mockResolvedValueOnce(null);
      const service = new UserService(repo);
      await expect(
        service.deactivate('missing', 'tenant-1', 'actor-1'),
      ).rejects.toBeInstanceOf(UserNotFoundError);
    });
  });
});
