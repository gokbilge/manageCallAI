export interface RegisterInput {
  tenant_name: string;
  tenant_slug: string;
  email: string;
  display_name: string;
  password: string;
}

export interface LoginInput {
  tenant_slug: string;
  email: string;
  password: string;
}

export interface AuthResult {
  id: string;
  tenant_id: string;
  email: string;
}
