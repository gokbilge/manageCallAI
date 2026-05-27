import type { Role } from './capabilities.js';

export interface AuthClaims {
  sub: string;
  tenant_id: string;
  email: string;
  role?: Role;
}
