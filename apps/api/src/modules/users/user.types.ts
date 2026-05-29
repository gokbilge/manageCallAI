export type TenantRole = 'tenant_admin' | 'tenant_operator' | 'tenant_viewer';

export const TENANT_ROLES: readonly TenantRole[] = ['tenant_admin', 'tenant_operator', 'tenant_viewer'];

export interface TenantUser {
  id: string;
  tenant_id: string;
  email: string;
  display_name: string;
  role: TenantRole;
  status: string;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateUserInput {
  tenant_id: string;
  email: string;
  display_name: string;
  role: TenantRole;
  password_hash: string;
}

export interface UpdateUserInput {
  display_name?: string;
  role?: TenantRole;
}
