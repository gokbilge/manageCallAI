import { z } from '../registry.js';

// ── Request schemas ───────────────────────────────────────────────────────────
export const RegisterBodySchema = z.object({
  tenant_name: z.string().min(1).max(100),
  tenant_slug: z.string().min(1).max(50).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
  email: z.string().max(254).regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/),
  display_name: z.string().min(1).max(255),
  password: z.string().min(8).max(128),
}).openapi('RegisterBody');
export type RegisterBody = z.infer<typeof RegisterBodySchema>;

export const LoginBodySchema = z.object({
  tenant_slug: z.string().min(1),
  email: z.string().min(1),
  password: z.string().min(1),
}).openapi('LoginBody');
export type LoginBody = z.infer<typeof LoginBodySchema>;

// ── Response schemas ──────────────────────────────────────────────────────────
export const AuthTokenResponseSchema = z.object({
  token: z.string(),
}).openapi('AuthTokenResponse');
export type AuthTokenResponse = z.infer<typeof AuthTokenResponseSchema>;
