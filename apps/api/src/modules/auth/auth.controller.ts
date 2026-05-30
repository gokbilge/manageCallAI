import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { RegisterBodySchema, LoginBodySchema } from '@managecallai/contracts';
import { db } from '../../db/client.js';
import { config } from '../../config/env.js';
import { AuthRepository } from './auth.repository.js';
import { AuthError, AuthService } from './auth.service.js';
import type { Role } from './capabilities.js';
import { sendAlreadyExists, sendUnauthenticated } from '../../errors/index.js';
import { fireAuditEvent } from '../audit/fire-audit.js';

const service = new AuthService(new AuthRepository(db));

export const authController: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/register',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      schema: { body: RegisterBodySchema },
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
          return sendAlreadyExists(reply, 'Tenant slug or email already exists');
        }
        throw err;
      }
    },
  );

  app.post(
    '/login',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: { body: LoginBodySchema },
    },
    async (req, reply) => {
      try {
        const result = await service.login(req.body);
        const role: Role = config.platformOperatorEmails.includes(result.email)
          ? 'platform_admin'
          : (result.role as Role);
        const token = app.jwt.sign({
          sub: result.id,
          tenant_id: result.tenant_id,
          email: result.email,
          role,
        });
        fireAuditEvent({
          tenant_id: result.tenant_id,
          actor_id: result.id,
          actor_type: 'user',
          action: 'auth.login',
          resource_type: 'user',
          resource_id: result.id,
          metadata: { role },
        });
        return { token };
      } catch (err) {
        if (err instanceof AuthError) {
          // Audit login failure without exposing the password or user ID.
          fireAuditEvent({
            tenant_id: 'system',
            actor_id: null,
            actor_type: 'system',
            action: 'auth.login_failed',
            resource_type: 'user',
            metadata: { tenant_slug: req.body.tenant_slug, reason: err.message },
          });
          return sendUnauthenticated(reply, err.message);
        }
        throw err;
      }
    },
  );
};
