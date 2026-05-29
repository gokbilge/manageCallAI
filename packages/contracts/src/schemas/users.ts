import { z } from '../registry.js';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const TenantRoleSchema = z.enum(['tenant_admin', 'tenant_operator', 'tenant_viewer']);
export type TenantRole = z.infer<typeof TenantRoleSchema>;

export const UserStatusSchema = z.enum(['active', 'inactive', 'pending']);
export type UserStatus = z.infer<typeof UserStatusSchema>;

// ── Resource schemas ──────────────────────────────────────────────────────────
export const TenantUserSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  email: z.string(),
  display_name: z.string(),
  role: TenantRoleSchema,
  status: z.string(),
  last_login_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).openapi('TenantUser');
export type TenantUser = z.infer<typeof TenantUserSchema>;

// ── Request schemas ───────────────────────────────────────────────────────────
export const CreateUserBodySchema = z.object({
  email: z.string().min(1).max(254),
  display_name: z.string().min(1).max(255),
  role: TenantRoleSchema,
  password: z.string().min(8).max(128),
}).openapi('CreateUserBody');
export type CreateUserBody = z.infer<typeof CreateUserBodySchema>;

export const UpdateUserBodySchema = z.object({
  display_name: z.string().min(1).max(255).optional(),
  role: TenantRoleSchema.optional(),
}).openapi('UpdateUserBody');
export type UpdateUserBody = z.infer<typeof UpdateUserBodySchema>;

export const ChangePasswordBodySchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8).max(128),
}).openapi('ChangePasswordBody');
export type ChangePasswordBody = z.infer<typeof ChangePasswordBodySchema>;
