import bcrypt from 'bcryptjs';
import type { AuthRepository } from './auth.repository.js';
import type { AuthResult, LoginInput, RegisterInput } from './auth.types.js';

const BCRYPT_ROUNDS = 12;

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export class AuthService {
  constructor(private readonly repo: AuthRepository) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const password_hash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const user = await this.repo.createTenantAndUser({
      tenant_name: input.tenant_name,
      tenant_slug: input.tenant_slug,
      email: input.email,
      display_name: input.display_name,
      password_hash,
    });
    return { id: user.id, tenant_id: user.tenant_id, email: user.email };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.repo.findUserByEmailAndSlug(input.email, input.tenant_slug);

    // Use constant-time comparison even when user is not found to prevent
    // timing-based user enumeration.
    const hash = user?.password_hash ?? '$2a$12$notavalidhashbutensuresconstanttime0000000000000000000';
    const valid = await bcrypt.compare(input.password, hash);

    if (!user || user.status !== 'active' || !valid) {
      throw new AuthError('Invalid credentials');
    }

    await this.repo.touchLastLogin(user.id);
    return { id: user.id, tenant_id: user.tenant_id, email: user.email };
  }
}
