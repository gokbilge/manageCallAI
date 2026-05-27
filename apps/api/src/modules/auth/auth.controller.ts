import type { FastifyInstance } from 'fastify';
import { db } from '../../db/client.js';
import { config } from '../../config/env.js';
import { AuthRepository } from './auth.repository.js';
import { AuthError, AuthService } from './auth.service.js';
import type { LoginInput, RegisterInput } from './auth.types.js';
import type { Role } from './capabilities.js';

const service = new AuthService(new AuthRepository(db));

export async function authController(app: FastifyInstance): Promise<void> {
  app.post<{ Body: RegisterInput }>(
    '/register',
    {
      schema: {
        body: {
          type: 'object',
          required: ['tenant_name', 'tenant_slug', 'email', 'display_name', 'password'],
          additionalProperties: false,
          properties: {
            tenant_name: { type: 'string', minLength: 1, maxLength: 100 },
            tenant_slug: {
              type: 'string',
              minLength: 1,
              maxLength: 50,
              pattern: '^[a-z0-9][a-z0-9-]*[a-z0-9]$',
            },
            email: {
              type: 'string',
              pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$',
              maxLength: 254,
            },
            display_name: { type: 'string', minLength: 1, maxLength: 255 },
            password: { type: 'string', minLength: 8, maxLength: 128 },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        const result = await service.register(req.body);
        const role: Role = config.platformOperatorEmails.includes(result.email)
          ? 'platform_admin'
          : 'tenant_admin';
        const token = app.jwt.sign({
          sub: result.id,
          tenant_id: result.tenant_id,
          email: result.email,
          role,
        });
        return reply.code(201).send({ token });
      } catch (err) {
        if ((err as { code?: string }).code === '23505') {
          return reply.code(409).send({ error: 'Tenant slug or email already exists' });
        }
        throw err;
      }
    },
  );

  app.post<{ Body: LoginInput }>(
    '/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['tenant_slug', 'email', 'password'],
          additionalProperties: false,
          properties: {
            tenant_slug: { type: 'string', minLength: 1 },
            email: { type: 'string', minLength: 1 },
            password: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (req, reply) => {
      try {
        const result = await service.login(req.body);
        const role: Role = config.platformOperatorEmails.includes(result.email)
          ? 'platform_admin'
          : 'tenant_admin';
        const token = app.jwt.sign({
          sub: result.id,
          tenant_id: result.tenant_id,
          email: result.email,
          role,
        });
        return { token };
      } catch (err) {
        if (err instanceof AuthError) {
          return reply.code(401).send({ error: err.message });
        }
        throw err;
      }
    },
  );
}
