import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AuthClaims } from '../modules/auth/auth-claims.js';

declare module 'fastify' {
  interface FastifyRequest {
    requestId: string;
  }
}

/**
 * Registers structured logging hooks on the Fastify instance.
 *
 * Every request gets a `requestId` (UUID). After JWT auth, `tenant_id` is
 * bound to the request logger. Routes that receive a `call_id` body/query
 * field bind it too.
 *
 * Log fields added:
 *   request_id  — stable across the request lifecycle
 *   tenant_id   — extracted from JWT claims when available
 *   call_id     — extracted from body/params when available
 */
export function registerLoggingHooks(app: FastifyInstance): void {
  app.addHook('onRequest', (req, _reply, done) => {
    const id = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
    req.requestId = id;
    req.log = req.log.child({ request_id: id });
    done();
  });

  // After route handler resolves auth, bind tenant and call identifiers.
  app.addHook('preHandler', (req, _reply, done) => {
    const user = req.user as AuthClaims | undefined;
    if (user?.tenant_id) {
      req.log = req.log.child({ tenant_id: user.tenant_id });
    }

    // Bind call_id from body, params, or query when present.
    const body = req.body as Record<string, unknown> | undefined;
    const params = req.params as Record<string, unknown> | undefined;
    const query = req.query as Record<string, unknown> | undefined;
    const callId =
      body?.['call_id'] ??
      params?.['call_id'] ??
      query?.['call_id'];
    if (typeof callId === 'string' && callId) {
      req.log = req.log.child({ call_id: callId });
    }

    done();
  });

  // Emit a single structured request-completed log line.
  app.addHook('onResponse', (req, reply, done) => {
    req.log.info(
      {
        method: req.method,
        url: req.url,
        status_code: reply.statusCode,
        response_time_ms: Math.round(reply.elapsedTime),
      },
      'request completed',
    );
    done();
  });
}

export function logError(req: FastifyRequest, _reply: FastifyReply, err: Error): void {
  req.log.error({ err: { message: err.message, name: err.name } }, 'request error');
}
