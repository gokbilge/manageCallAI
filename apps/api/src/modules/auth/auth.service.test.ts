import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService, AuthError } from './auth.service.js';
import type { AuthRepository } from './auth.repository.js';

const mockRepo = {
  findUserByEmailAndSlug: vi.fn(),
  createTenantAndUser: vi.fn(),
  touchLastLogin: vi.fn(),
} as unknown as AuthRepository;

const service = new AuthService(mockRepo);

const activeUser = {
  id: 'user-1',
  tenant_id: 'tenant-1',
  email: 'alice@acme.com',
  display_name: 'Alice',
  role: 'tenant_admin',
  status: 'active',
  // This is bcrypt('correct-password', 12) — pre-computed to avoid slow hashing in tests.
  // Use `bcryptjs.hashSync('correct-password', 12)` to regenerate.
  password_hash: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lfHJlA4xOVzJkqMmC',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AuthService.login', () => {
  it('throws AuthError when user is not found', async () => {
    vi.mocked(mockRepo.findUserByEmailAndSlug).mockResolvedValue(null);
    await expect(
      service.login({ tenant_slug: 'acme', email: 'nobody@acme.com', password: 'anything' }),
    ).rejects.toThrow(AuthError);
  });

  it('throws AuthError when user is inactive', async () => {
    vi.mocked(mockRepo.findUserByEmailAndSlug).mockResolvedValue({
      ...activeUser,
      status: 'inactive',
    });
    await expect(
      service.login({ tenant_slug: 'acme', email: activeUser.email, password: 'anything' }),
    ).rejects.toThrow(AuthError);
  });

  it('throws AuthError when password is wrong', async () => {
    vi.mocked(mockRepo.findUserByEmailAndSlug).mockResolvedValue(activeUser);
    await expect(
      service.login({ tenant_slug: 'acme', email: activeUser.email, password: 'wrong-password' }),
    ).rejects.toThrow(AuthError);
  });
});

describe('AuthService.register', () => {
  it('calls createTenantAndUser with a hashed password, not plaintext', async () => {
    vi.mocked(mockRepo.createTenantAndUser).mockResolvedValue({
      id: 'user-1',
      tenant_id: 'tenant-1',
      email: 'bob@newco.com',
    });

    await service.register({
      tenant_name: 'NewCo',
      tenant_slug: 'newco',
      email: 'bob@newco.com',
      display_name: 'Bob',
      password: 'secret123',
    });

    const call = vi.mocked(mockRepo.createTenantAndUser).mock.calls[0]![0];
    expect(call.password_hash).not.toBe('secret123');
    expect(call.password_hash).toMatch(/^\$2[ab]\$/);
  });

  it('returns id, tenant_id, and email from the created user', async () => {
    vi.mocked(mockRepo.createTenantAndUser).mockResolvedValue({
      id: 'user-1',
      tenant_id: 'tenant-1',
      email: 'bob@newco.com',
    });

    const result = await service.register({
      tenant_name: 'NewCo',
      tenant_slug: 'newco',
      email: 'bob@newco.com',
      display_name: 'Bob',
      password: 'secret123',
    });

    expect(result).toEqual({ id: 'user-1', tenant_id: 'tenant-1', email: 'bob@newco.com', role: 'tenant_admin' });
  });
});
