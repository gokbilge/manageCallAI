import type { Role } from './capabilities.js';

export interface AuthClaims {
  sub: string;
  tenant_id: string;
  email: string;
  role?: Role;
  /**
   * Explicit capability list for API key authentication.
   * When present, `requireCapability` checks this list instead of deriving
   * capabilities from `role`. The special value ['*'] grants the full
   * tenant_admin capability set (legacy behaviour for existing API keys).
   */
  capabilities?: readonly string[];
}
