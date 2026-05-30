import type { Role } from './capabilities.js';

/** JWT-authenticated user — always has a role, never an explicit capability list. */
export interface JwtClaims {
  sub: string;
  tenant_id: string;
  email: string;
  role: Role;
  capabilities?: never;
}

/** API-key-authenticated client — has an explicit capability list, no role. */
export interface ApiKeyClaims {
  sub: string;
  tenant_id: string;
  email: string;
  role?: never;
  capabilities: readonly string[];
}

export type AuthClaims = JwtClaims | ApiKeyClaims;
