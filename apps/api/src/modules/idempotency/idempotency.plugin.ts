import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { IdempotencyRepository } from './idempotency.repository.js';

const HEADER = 'idempotency-key';
const REPLAY_HEADER = 'idempotency-replayed';
const MAX_KEY_LENGTH = 255;

const repo = new IdempotencyRepository(db);

/**
 * Fastify plugin that adds idempotency key support to POST/PATCH routes.
 *
 * Usage: register on a specific route or a prefix.
 *
 * If the request carries an `Idempotency-Key` header:
 *   - The handler runs normally on first call.
 *   - Subsequent calls with the same key (within 24h) get the cached response
 *     with `Idempotency-Replayed: true`.
 *
 * Requires JWT auth to have run first (needs tenant_id from claims).
 * Keys are scoped to (tenant_id, idempotency_key) — cross-tenant replay is impossible.
 */
export const idempotencyPlugin: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.method !== 'POST' && req.method !== 'PATCH' && req.method !== 'PUT') return;

    const rawKey = req.headers[HEADER];
    if (typeof rawKey !== 'string' || rawKey.trim() === '') return;
    const key = rawKey.trim();

    if (key.length > MAX_KEY_LENGTH) {
      return reply.code(400).send({
        error: 'INVALID_ARGUMENT',
        message: `Idempotency-Key must be at most ${MAX_KEY_LENGTH} characters`,
      });
    }

    const user = req.user as AuthClaims | undefined;
    if (!user?.tenant_id) return;

    const existing = await repo.find(user.tenant_id, key);
    if (existing) {
      reply.header(REPLAY_HEADER, 'true');
      return reply.code(existing.status_code).send(existing.response_body);
    }
  });

  app.addHook('onSend', async (req: FastifyRequest, reply: FastifyReply, payload) => {
    if (req.method !== 'POST' && req.method !== 'PATCH' && req.method !== 'PUT') return payload;

    const rawKey = req.headers[HEADER];
    if (typeof rawKey !== 'string' || rawKey.trim() === '') return payload;

    if (reply.hasHeader(REPLAY_HEADER)) return payload;

    const user = req.user as AuthClaims | undefined;
    if (!user?.tenant_id) return payload;

    const statusCode = reply.statusCode;
    if (statusCode < 200 || statusCode > 299) return payload;

    let body: Record<string, unknown> | null = null;
    if (typeof payload === 'string') {
      try { body = JSON.parse(payload) as Record<string, unknown>; } catch { /* skip non-JSON */ }
    }

    if (body !== null) {
      await repo.store(user.tenant_id, rawKey.trim(), statusCode, body).catch(() => undefined);
    }

    return payload;
  });
};
